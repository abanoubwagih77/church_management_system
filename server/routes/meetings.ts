import { Router, Response } from 'express';
import {
  getDb,
  createGeneralMeetingAtomic,
  updateGeneralMeetingAtomic,
  deleteGeneralMeetingAtomic,
  saveLocalDatabaseOnly,
} from '../db.js';
import { authenticateJwt, requirePermission, getEffectiveChurchId, getClientIp, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';
import { GeneralMeeting, GeneralMeetingRecord } from '../../src/types/index.js';

export const meetingsRouter = Router();

// Helper to check if servant is a priest
export function isServantPriest(servant: { current_role?: string; full_name?: string }): boolean {
  const role = (servant.current_role || '').toLowerCase();
  const name = (servant.full_name || '').trim();
  return (
    role.includes('كاهن') ||
    role.includes('priest') ||
    name.startsWith('أبونا') ||
    name.startsWith('القمص') ||
    name.startsWith('القس')
  );
}

// Format ISO time to Arabic AM/PM using Cairo Egypt Timezone (UTC+2 / UTC+3)
export function formatTimeToArabic(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('ar-EG', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

// 1. GET /api/meetings - List all general meetings with summarized stats
meetingsRouter.get('/', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  let meetings = db.general_meetings || [];
  if (churchId) {
    meetings = meetings.filter((m) => m.church_id === churchId);
  }

  const servants = db.servants.filter(
    (s) => s.status === 'active' && !isServantPriest(s) && (churchId ? s.church_id === churchId : true)
  );
  const totalEligibleServants = servants.length;

  const enriched = meetings
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((m) => {
      const records = (db.general_meeting_records || []).filter(
        (r) => r.meeting_id === m.id || (r.date === m.date && servants.some((s) => s.id === r.servant_id))
      );

      const presentCount = records.filter(
        (r) => r.status === 'present' || r.status === 'checked_in' || r.status === 'completed'
      ).length;

      const lateAbsentCount = records.filter((r) => r.status === 'late_absent' || r.is_late).length;

      // Unscanned servants count
      const recordedServantIds = new Set(records.map((r) => r.servant_id));
      const notScannedCount = Math.max(0, totalEligibleServants - recordedServantIds.size);
      const totalAbsent = lateAbsentCount + notScannedCount;

      const percentage =
        totalEligibleServants > 0
          ? Math.round((presentCount / totalEligibleServants) * 100)
          : 0;

      return {
        ...m,
        stats: {
          total_eligible: totalEligibleServants,
          present: presentCount,
          late_absent: lateAbsentCount,
          not_scanned: notScannedCount,
          total_absent: totalAbsent,
          attendance_percentage: percentage,
        },
      };
    });

  res.json({
    success: true,
    meetings: enriched,
    total_eligible_servants: totalEligibleServants,
  });
});

// 2. GET /api/meetings/today - Get today's meeting or null
meetingsRouter.get('/today', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  const today = new Date().toISOString().split('T')[0];
  const meeting = (db.general_meetings || []).find(
    (m) => m.date === today && m.status !== 'cancelled' && (!churchId || !m.church_id || m.church_id === churchId)
  );

  res.json({
    success: true,
    today,
    meeting: meeting || null,
  });
});

// 3. GET /api/meetings/:id - Get specific meeting with complete attendance roster
meetingsRouter.get('/:id', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const meeting = (db.general_meetings || []).find((m) => m.id === id);

  if (!meeting) {
    res.status(404).json({ error: 'الاجتماع غير موجود' });
    return;
  }

  // Strictly filter active servants belonging to this meeting's church only
  const targetChurchId = meeting.church_id || getEffectiveChurchId(req);
  const allServants = db.servants.filter(
    (s) => s.status === 'active' && (targetChurchId ? s.church_id === targetChurchId : true)
  );
  const records = (db.general_meeting_records || []).filter(
    (r) => r.meeting_id === meeting.id || (r.date === meeting.date && allServants.some((s) => s.id === r.servant_id))
  );

  const recordsMap = new Map<string, GeneralMeetingRecord>();
  records.forEach((r) => recordsMap.set(r.servant_id, r));

  // Build complete roster for all active servants
  const roster = allServants.map((servant) => {
    const isPriest = isServantPriest(servant);
    const rec = recordsMap.get(servant.id);
    const service = db.services.find((s) => s.id === servant.current_service_id);
    const serviceName = service ? service.name_ar : 'غير محدد';

    if (isPriest) {
      return {
        servant_id: servant.id,
        servant_name: servant.full_name,
        servant_phone: servant.phone,
        service_id: servant.current_service_id,
        service_name: serviceName,
        current_role: servant.current_role || 'أب كاهن',
        status: 'priest_exempt',
        is_priest: true,
        check_in_time: rec?.check_in_time ? formatTimeToArabic(rec.check_in_time) : '',
        check_in_time_raw: rec?.check_in_time || null,
        check_out_time: rec?.check_out_time ? formatTimeToArabic(rec.check_out_time) : '',
        duration_minutes: rec?.duration_minutes,
        scanner_device_name: rec?.scanner_device_name,
      };
    }

    if (rec) {
      let finalStatus: 'present' | 'late_absent' | 'completed' = 'present';
      if (rec.status === 'late_absent' || rec.is_late) {
        finalStatus = 'late_absent';
      } else if (rec.status === 'completed') {
        finalStatus = 'completed';
      }

      return {
        servant_id: servant.id,
        servant_name: servant.full_name,
        servant_phone: servant.phone,
        service_id: servant.current_service_id,
        service_name: serviceName,
        current_role: servant.current_role,
        status: finalStatus,
        is_late: rec.is_late || rec.status === 'late_absent',
        check_in_time: rec.check_in_time ? formatTimeToArabic(rec.check_in_time) : '',
        check_in_time_raw: rec.check_in_time || null,
        check_out_time: rec.check_out_time ? formatTimeToArabic(rec.check_out_time) : '',
        duration_minutes: rec.duration_minutes,
        scanner_device_name: rec.scanner_device_name,
        notes: rec.notes,
      };
    }

    // Not scanned yet -> Absent
    return {
      servant_id: servant.id,
      servant_name: servant.full_name,
      servant_phone: servant.phone,
      service_id: servant.current_service_id,
      service_name: serviceName,
      current_role: servant.current_role,
      status: 'absent',
      is_late: false,
      check_in_time: '',
      check_in_time_raw: null,
      check_out_time: '',
      duration_minutes: undefined,
      scanner_device_name: undefined,
      notes: 'لم يسجل الحضور',
    };
  });

  // Calculate statistics (excluding priests from totals)
  const eligibleRoster = roster.filter((r) => !r.is_priest);
  const presentCount = eligibleRoster.filter(
    (r) => r.status === 'present' || r.status === 'completed'
  ).length;
  const lateAbsentCount = eligibleRoster.filter((r) => r.status === 'late_absent').length;
  const absentCount = eligibleRoster.filter((r) => r.status === 'absent').length;
  const totalEligible = eligibleRoster.length;
  const percentage =
    totalEligible > 0 ? Math.round((presentCount / totalEligible) * 100) : 0;

  res.json({
    success: true,
    meeting,
    stats: {
      total_eligible: totalEligible,
      present: presentCount,
      late_absent: lateAbsentCount,
      absent: absentCount,
      total_absent: lateAbsentCount + absentCount,
      attendance_percentage: percentage,
      priests_count: roster.filter((r) => r.is_priest).length,
    },
    roster,
  });
});

// 4. POST /api/meetings - Create a new general meeting
meetingsRouter.post(
  '/',
  authenticateJwt,
  requirePermission('add_attendance', 'full_access'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const db = getDb();
    const {
      title,
      speaker,
      date,
      start_time,
      end_time,
      late_cutoff_time,
      notes,
    } = req.body;

    if (!title || !speaker) {
      res.status(400).json({ error: 'عنوان الاجتماع/الموضوع واسم المحاضر حقول مطلوبة' });
      return;
    }

    const meetingDate = date || new Date().toISOString().split('T')[0];
    const startTime = start_time || '12:00';
    const endTime = end_time || '14:00';
    const cutoffTime = late_cutoff_time || '13:00';

    const churchId = getEffectiveChurchId(req);
    const nowIso = new Date().toISOString();
    const newMeeting: GeneralMeeting = {
      id: `meeting_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      church_id: churchId || undefined,
      title: String(title).trim(),
      speaker: String(speaker).trim(),
      date: meetingDate,
      start_time: startTime,
      end_time: endTime,
      late_cutoff_time: cutoffTime,
      notes: notes ? String(notes).trim() : '',
      status: 'active',
      created_by_user_id: user.id,
      created_by_name: user.name,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await createGeneralMeetingAtomic(newMeeting);

    logAudit({
      userId: user.id,
      username: user.name,
      churchId: churchId,
      action: 'MEETING_CREATED',
      targetType: 'MEETING',
      targetId: newMeeting.id,
      targetName: newMeeting.title,
      description: `قام (${user.name}) بإنشاء اجتماع خدام جديد: "${newMeeting.title}"، المحاضر: (${newMeeting.speaker})، الموعد: من ${newMeeting.start_time} إلى ${newMeeting.end_time}، وآخر ميعاد للحضور: ${newMeeting.late_cutoff_time}`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      message: 'تم إنشاء الاجتماع بنجاح',
      meeting: newMeeting,
    });
  }
);

// 5. PUT /api/meetings/:id - Update meeting details
meetingsRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission('edit_attendance', 'full_access'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();
    const meeting = (db.general_meetings || []).find((m) => m.id === id);

    if (!meeting) {
      res.status(404).json({ error: 'الاجتماع غير موجود' });
      return;
    }

    const {
      title,
      speaker,
      date,
      start_time,
      end_time,
      late_cutoff_time,
      notes,
      status,
    } = req.body;

    const meetingUpdates: Partial<GeneralMeeting> = {};
    if (title) meetingUpdates.title = String(title).trim();
    if (speaker) meetingUpdates.speaker = String(speaker).trim();
    if (date) meetingUpdates.date = String(date).trim();
    if (start_time) meetingUpdates.start_time = String(start_time).trim();
    if (end_time) meetingUpdates.end_time = String(end_time).trim();
    if (late_cutoff_time) meetingUpdates.late_cutoff_time = String(late_cutoff_time).trim();
    if (notes !== undefined) meetingUpdates.notes = String(notes).trim();
    if (status) meetingUpdates.status = status;
    meetingUpdates.updated_at = new Date().toISOString();

    await updateGeneralMeetingAtomic(id, meetingUpdates);

    const churchId = meeting.church_id || getEffectiveChurchId(req);

    logAudit({
      userId: user.id,
      username: user.name,
      churchId: churchId,
      action: 'MEETING_UPDATED',
      targetType: 'MEETING',
      targetId: meeting.id,
      targetName: meetingUpdates.title || meeting.title,
      description: `قام (${user.name}) بتعديل تفاصيل اجتماع الخدام: "${meetingUpdates.title || meeting.title}"`,
      ipAddress: getClientIp(req),
    });

    const updatedMeeting = (db.general_meetings || []).find((m) => m.id === id) || { ...meeting, ...meetingUpdates };
    res.json({
      success: true,
      message: 'تم تعديل بيانات الاجتماع بنجاح',
      meeting: updatedMeeting,
    });
  }
);

// 6. DELETE /api/meetings/:id - Delete a meeting
meetingsRouter.delete(
  '/:id',
  authenticateJwt,
  requirePermission('delete_attendance', 'edit_attendance', 'full_access'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();
    const index = (db.general_meetings || []).findIndex((m) => m.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'الاجتماع غير موجود' });
      return;
    }

    const deleted = db.general_meetings[index];
    const churchId = deleted.church_id || getEffectiveChurchId(req);

    await deleteGeneralMeetingAtomic(id);

    // Also remove meeting records locally
    db.general_meeting_records = (db.general_meeting_records || []).filter(
      (r) => r.meeting_id !== id
    );
    saveLocalDatabaseOnly();

    logAudit({
      userId: user.id,
      username: user.name,
      churchId: churchId,
      action: 'MEETING_DELETED',
      targetType: 'MEETING',
      targetId: id,
      targetName: deleted.title,
      description: `قام (${user.name}) بحذف اجتماع الخدام: "${deleted.title}" وسجلات حضوره`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      message: 'تم حذف الاجتماع بنجاح',
    });
  }
);
