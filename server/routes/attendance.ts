import { Router, Response } from 'express';
import {
  getDb,
  writeAttendanceBatch,
  updateAttendanceRecordAtomic,
  deleteAttendanceRecordAtomic,
} from '../db.js';
import { authenticateJwt, requirePermission, checkScopeAccess, getEffectiveChurchId, getClientIp, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';
import { AttendanceRecord } from '../../src/types/index.js';

export const attendanceRouter = Router();

attendanceRouter.use(authenticateJwt);

// GET /api/attendance - List and filter attendance records
attendanceRouter.get('/', requirePermission('view_attendance'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  let records = [...db.attendance];

  if (churchId) {
    records = records.filter((r) => !r.church_id || r.church_id === churchId);
  }

  // Scope filter
  if (user.role !== 'super_admin' && user.scope !== 'all') {
    records = records.filter((r) => r.service_id === user.scope);
  }

  const serviceId = req.query.service_id ? String(req.query.service_id) : '';
  if (serviceId) {
    if (!checkScopeAccess(user, serviceId)) {
      res.status(403).json({ error: 'ليس لديك صلاحية لعرض غياب هذه الخدمة' });
      return;
    }
    records = records.filter((r) => r.service_id === serviceId);
  }

  const date = req.query.date ? String(req.query.date) : '';
  if (date) {
    records = records.filter((r) => r.date === date);
  }

  const servantId = req.query.servant_id ? String(req.query.servant_id) : '';
  if (servantId) {
    records = records.filter((r) => r.servant_id === servantId);
  }

  const status = req.query.status ? String(req.query.status) : '';
  if (status) {
    records = records.filter((r) => r.status === status);
  }

  // Calculate metrics
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const excused = records.filter((r) => r.status === 'excused').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

  // Enrich with names
  const enriched = records
    .slice()
    .reverse()
    .map((r) => {
      const servant = db.servants.find((s) => s.id === r.servant_id);
      const service = db.services.find((s) => s.id === r.service_id);
      return {
        ...r,
        servant_name: servant ? servant.full_name : 'خادم محذوف',
        servant_phone: servant ? servant.phone : '',
        service_name: service ? service.name_ar : 'خدمة',
      };
    });

  res.json({
    success: true,
    stats: {
      total,
      present,
      absent,
      excused,
      percentage,
    },
    records: enriched,
  });
});

// GET /api/attendance/sheet - Generate attendance sheet for a service & date
attendanceRouter.get('/sheet', requirePermission('view_attendance'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  const serviceId = req.query.service_id ? String(req.query.service_id) : '';
  const date = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];

  if (!serviceId) {
    res.status(400).json({ error: 'معرف الخدمة مطلوب' });
    return;
  }

  if (!checkScopeAccess(user, serviceId)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لعرض كشف هذه الخدمة' });
    return;
  }

  const service = db.services.find((s) => s.id === serviceId);
  if (!service) {
    res.status(404).json({ error: 'الخدمة غير موجودة' });
    return;
  }

  // Get matching active servants for this service & church
  let servants = db.servants.filter(
    (s) => s.current_service_id === serviceId && s.status === 'active' && (!churchId || !s.church_id || s.church_id === churchId)
  );

  const sheet = servants.map((servant) => {
    // Existing attendance record on that date
    const existing = (db.attendance || []).find(
      (a) => a.servant_id === servant.id && a.service_id === serviceId && a.date === date
    );

    // Historical attendance rate
    const history = (db.attendance || []).filter((a) => a.servant_id === servant.id && a.service_id === serviceId);
    const presentCount = history.filter((a) => a.status === 'present').length;
    const attendanceRate = history.length > 0 ? Math.round((presentCount / history.length) * 100) : 100;

    return {
      servant_id: servant.id,
      servant_name: servant.full_name,
      full_name: servant.full_name,
      phone: servant.phone,
      attendance_rate: attendanceRate,
      has_history: history.length > 0,
      status: existing ? existing.status : null,
      notes: existing?.notes || '',
    };
  });

  res.json({
    success: true,
    service,
    date,
    sheet,
  });
});

// POST /api/attendance/bulk - Record or update bulk attendance for a meeting/service
attendanceRouter.post('/bulk', requirePermission('add_attendance'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const { service_id, date } = req.body;
  const rawList = req.body.entries || req.body.records;

  if (!service_id || !date || !Array.isArray(rawList)) {
    res.status(400).json({ error: 'الخدمة، التاريخ، وقائمة الخدام حقول مطلوبة' });
    return;
  }

  const entries = rawList;

  if (!checkScopeAccess(user, service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لتسجيل حضور في هذه الخدمة' });
    return;
  }

  const srv = db.services.find((s) => s.id === service_id);
  const nowIso = new Date().toISOString();
  let updatedCount = 0;
  let createdCount = 0;

  const recordsToPersist: AttendanceRecord[] = [];

  for (const entry of entries) {
    if (!entry.servant_id || !entry.status) continue;

    // Check if a record already exists in cache for this servant on this date
    const existing = db.attendance.find(
      (r) => r.servant_id === entry.servant_id && r.date === date && r.service_id === service_id
    );

    if (existing) {
      const updatedRecord: AttendanceRecord = {
        ...existing,
        status: entry.status,
        notes: entry.notes !== undefined ? entry.notes : existing.notes,
        recorded_by_user_id: user.id,
        recorded_by_name: user.name,
      };
      recordsToPersist.push(updatedRecord);
      updatedCount++;
    } else {
      const churchId = getEffectiveChurchId(req);
      const newRecord: AttendanceRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        church_id: churchId || undefined,
        servant_id: entry.servant_id,
        service_id,
        date,
        status: entry.status,
        notes: entry.notes,
        recorded_by_user_id: user.id,
        recorded_by_name: user.name,
        created_at: nowIso,
      };
      recordsToPersist.push(newRecord);
      createdCount++;
    }
  }

  try {
    // 1. Atomic Firestore WriteBatch (All-or-Nothing)
    await writeAttendanceBatch(recordsToPersist);

    // 2. Audit logging (runs after confirmed Firestore persistence)
    try {
      const churchId = getEffectiveChurchId(req);
      logAudit({
        userId: user.id,
        username: user.username,
        churchId: churchId,
        action: 'ATTENDANCE_BULK_RECORD',
        targetType: 'ATTENDANCE',
        targetId: service_id,
        targetName: srv ? srv.name_ar : service_id,
        description: `قام المستخدم (${user.name}) بتسجيل حضور لخدمة (${srv?.name_ar || service_id}) لتاريخ (${date}) بإجمالي ${entries.length} سجل (${createdCount} جديد، ${updatedCount} تعديل)`,
        ipAddress: getClientIp(req),
      });
    } catch (auditErr) {
      console.warn('Audit log warning in bulk attendance:', auditErr);
    }

    res.json({
      success: true,
      message: `تم حفظ الحضور بنجاح (${createdCount} جديد، ${updatedCount} تعديل)`,
      createdCount,
      updatedCount,
    });
  } catch (err: any) {
    console.error('Error during bulk attendance write:', err);
    res.status(500).json({ error: 'فشل حفظ سجلات الحضور في قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف') });
  }
});

// PUT /api/attendance/:id - Update single record (Captain updating attendance status)
attendanceRouter.put('/:id', requirePermission('edit_attendance'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const record = db.attendance.find((r) => r.id === req.params.id);

  if (!record) {
    res.status(404).json({ error: 'سجل الحضور غير موجود' });
    return;
  }

  if (!checkScopeAccess(user, record.service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لتعديل سجل الحضور في هذه الخدمة' });
    return;
  }

  const { status, notes } = req.body;
  const beforeStatus = record.status;
  const servant = db.servants.find((s) => s.id === record.servant_id);

  const updatedRecord: AttendanceRecord = {
    ...record,
    status: status || record.status,
    notes: notes !== undefined ? notes : record.notes,
    recorded_by_user_id: user.id,
    recorded_by_name: user.name,
  };

  try {
    // 1. Atomic Firestore Document Write
    await updateAttendanceRecordAtomic(updatedRecord);

    // 2. Audit logging
    try {
      const churchId = record.church_id || getEffectiveChurchId(req);
      logAudit({
        userId: user.id,
        username: user.username,
        churchId: churchId,
        action: 'ATTENDANCE_UPDATE',
        targetType: 'ATTENDANCE',
        targetId: record.id,
        targetName: servant ? servant.full_name : record.servant_id,
        description: `قام المستخدم (${user.name}) بتعديل حالة حضور الخادم (${servant?.full_name || record.servant_id}) لتاريخ (${record.date}) من (${beforeStatus}) إلى (${updatedRecord.status})`,
        ipAddress: getClientIp(req),
        changes: {
          before: { status: beforeStatus },
          after: { status: updatedRecord.status },
        },
      });
    } catch (auditErr) {
      console.warn('Audit log warning in attendance update:', auditErr);
    }

    res.json({ success: true, record: updatedRecord });
  } catch (err: any) {
    console.error('Error updating attendance record:', err);
    res.status(500).json({ error: 'فشل تحديث سجل الحضور في قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف') });
  }
});

// DELETE /api/attendance/:id
attendanceRouter.delete('/:id', requirePermission('delete_attendance'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const index = db.attendance.findIndex((r) => r.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'السجل غير موجود' });
    return;
  }

  const record = db.attendance[index];
  if (!checkScopeAccess(user, record.service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لحذف سجلات هذه الخدمة' });
    return;
  }

  const servant = db.servants.find((s) => s.id === record.servant_id);

  try {
    // 1. Atomic Firestore Delete
    await deleteAttendanceRecordAtomic(record.service_id, record.servant_id, record.date, record.id);

    // 2. Audit logging
    try {
      const churchId = record.church_id || getEffectiveChurchId(req);
      logAudit({
        userId: user.id,
        username: user.username,
        churchId: churchId,
        action: 'ATTENDANCE_DELETE',
        targetType: 'ATTENDANCE',
        targetId: record.id,
        targetName: servant ? servant.full_name : record.servant_id,
        description: `قام المستخدم (${user.name}) بحذف سجل حضور الخادم (${servant?.full_name || record.servant_id}) لتاريخ (${record.date})`,
        ipAddress: getClientIp(req),
      });
    } catch (auditErr) {
      console.warn('Audit log warning in attendance delete:', auditErr);
    }

    res.json({ success: true, message: 'تم حذف السجل بنجاح' });
  } catch (err: any) {
    console.error('Error deleting attendance record:', err);
    res.status(500).json({ error: 'فشل حذف سجل الحضور من قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف') });
  }
});
