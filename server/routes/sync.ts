import { Router, Response } from 'express';
import { getDb, saveDatabase } from '../db.js';
import { authenticateJwt, getEffectiveChurchId, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';

export const syncRouter = Router();

// POST /api/sync/restore - Sync client-side records into server /tmp or file database
syncRouter.post('/restore', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { servants, meetings, services, general_meeting_records } = req.body || {};
    const db = getDb();
    const churchId = getEffectiveChurchId(req);
    let updated = false;

    if (Array.isArray(servants) && servants.length > 0) {
      // Merge servants by id
      const existingIds = new Set((db.servants || []).map((s) => s.id));
      for (const s of servants) {
        if (!existingIds.has(s.id)) {
          db.servants.push({ ...s, church_id: churchId || s.church_id });
          existingIds.add(s.id);
          updated = true;
        }
      }
    }

    if (Array.isArray(meetings) && meetings.length > 0) {
      if (!db.general_meetings) db.general_meetings = [];
      const existingMeetingIds = new Set(db.general_meetings.map((m) => m.id));
      for (const m of meetings) {
        if (!existingMeetingIds.has(m.id)) {
          db.general_meetings.push({ ...m, church_id: churchId || m.church_id });
          existingMeetingIds.add(m.id);
          updated = true;
        }
      }
    }

    if (Array.isArray(services) && services.length > 0) {
      if (!db.services) db.services = [];
      const existingServiceIds = new Set(db.services.map((s) => s.id));
      for (const s of services) {
        if (!existingServiceIds.has(s.id)) {
          db.services.push({ ...s, church_id: churchId || s.church_id });
          existingServiceIds.add(s.id);
          updated = true;
        }
      }
    }

    if (Array.isArray(general_meeting_records) && general_meeting_records.length > 0) {
      if (!db.general_meeting_records) db.general_meeting_records = [];
      const existingRecKeys = new Set(
        db.general_meeting_records.map((r) => `${r.meeting_id}_${r.servant_id}`)
      );
      for (const r of general_meeting_records) {
        const key = `${r.meeting_id}_${r.servant_id}`;
        if (!existingRecKeys.has(key)) {
          db.general_meeting_records.push({ ...r, church_id: churchId || r.church_id });
          existingRecKeys.add(key);
          updated = true;
        }
      }
    }

    if (updated) {
      saveDatabase();
    }

    res.json({
      success: true,
      message: 'تمت مزامنة وحفظ البيانات بنجاح',
      counts: {
        servants: db.servants?.length || 0,
        meetings: db.general_meetings?.length || 0,
        services: db.services?.length || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل مزامنة البيانات' });
  }
});

// POST /api/sync/reset-test-data - Reset test data for a clean fresh start (Admin only)
syncRouter.post('/reset-test-data', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'super_admin' && user.role !== 'church_admin' && user.role !== 'priest') {
    res.status(403).json({ error: 'صلاحية تنظيف بيانات النظام مقتصرة على الإدارة العليا أو كاهن الكنيسة' });
    return;
  }

  const { target } = req.body || {}; // 'all', 'meetings', 'servants'
  const db = getDb();
  const churchId = getEffectiveChurchId(req);

  if (churchId) {
    if (target === 'meetings' || target === 'all') {
      db.general_meetings = (db.general_meetings || []).filter((m) => m.church_id && m.church_id !== churchId);
      db.general_meeting_records = (db.general_meeting_records || []).filter(
        (r) => r.church_id && r.church_id !== churchId
      );
    }

    if (target === 'servants' || target === 'all') {
      db.servants = (db.servants || []).filter((s) => s.church_id && s.church_id !== churchId);
      db.attendance = (db.attendance || []).filter((a) => a.church_id && a.church_id !== churchId);
      db.assignments = (db.assignments || []).filter((asg) => asg.church_id && asg.church_id !== churchId);
    }
  } else {
    if (target === 'meetings' || target === 'all') {
      db.general_meetings = [];
      db.general_meeting_records = [];
    }

    if (target === 'servants' || target === 'all') {
      db.servants = [];
      db.attendance = [];
      db.assignments = [];
    }
  }

  saveDatabase();

  logAudit({
    userId: user.id,
    username: user.name,
    action: 'SYSTEM_RESET_TEST_DATA',
    targetType: 'SYSTEM',
    description: `قام (${user.name}) بتنظيف البيانات التجريبية لبدء تشغيل نظيف (${target || 'all'})`,
  });

  res.json({
    success: true,
    message: 'تم تنظيف البيانات التجريبية بنجاح للبدء بنظافة',
  });
});

// POST /api/sync/force-cloud-push - Trigger manual push to Cloud Firestore
syncRouter.post('/force-cloud-push', authenticateJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pushToFirestoreImmediate, getCloudSyncInfo } = await import('../db.js');
    await pushToFirestoreImmediate();
    const info = getCloudSyncInfo();
    if (info.isQuotaExhausted) {
      res.status(429).json({
        success: false,
        message: 'تم بلوغ الحد اليومي المجاني لفايربيز. سيتم استئناف المزامنة تلقائياً مع إعادة تعيين الحصة اليومية في منتصف الليل.',
        info,
      });
      return;
    }
    res.json({
      success: true,
      message: 'تم رفع كافة البيانات الحالية إلى Cloud Firestore بنجاح وبشكل دائم.',
      info,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل الرفع السحابي' });
  }
});
