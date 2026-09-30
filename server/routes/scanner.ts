import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getDb,
  saveLocalDatabaseOnly,
  ensureDatabaseReady,
  runScannerCheckinTransaction,
  recordDeletedId,
  createScannerDeviceAtomic,
  updateScannerDeviceAtomic,
  deleteScannerDeviceAtomic,
} from '../db.js';
import { db as firestoreDb, doc, getDoc, updateDoc } from '../firebase.js';
import { authenticateJwt, requirePermission, getEffectiveChurchId, getClientIp, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';
import { ScannerDevice, DeviceRegistrationCode, GeneralMeetingRecord, GeneralMeeting } from '../../src/types/index.js';
import { isServantPriest } from './meetings.js';

export const scannerRouter = Router();

// 1. Generate 8-digit device pairing code (Priest, Super Admin, General Secretary)
// Valid for exactly 10 minutes
scannerRouter.post(
  '/code/generate',
  authenticateJwt,
  requirePermission('manage_scanner', 'full_access'),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const db = getDb();
    const churchId = getEffectiveChurchId(req);

    // Generate random 8-digit numeric string
    const codeNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const regCode: DeviceRegistrationCode = {
      code: codeNumber,
      church_id: churchId || undefined,
      created_by_user_id: user.id,
      created_by_name: user.name,
      expires_at: expiresAt,
      used: false,
    };

    db.registration_codes.push(regCode);
    saveLocalDatabaseOnly();

    logAudit({
      userId: user.id,
      username: user.username,
      action: 'SCANNER_CODE_GENERATED',
      targetType: 'SCANNER',
      description: `قام (${user.name}) بتوليد كود تسجيل جهاز سكانر جديد (${codeNumber}) صالح لمدة 5 دقائق`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      code: codeNumber,
      expires_at: expiresAt,
      valid_for_seconds: 300,
    });
  }
);

// 2. Register new scanner device using 8-digit OTP (Public - called from trusted mobile)
scannerRouter.post('/devices/register', async (req: Request, res: Response) => {
  const { code, device_name } = req.body;
  const ip = getClientIp(req);

  if (!code || !device_name) {
    res.status(400).json({ error: 'يرجى إدخال كود التسجيل المكون من 8 أرقام واسم للجهاز' });
    return;
  }

  const cleanCode = String(code).trim();
  const cleanName = String(device_name).trim();

  if (cleanCode.length !== 8 || !/^\d+$/.test(cleanCode)) {
    res.status(400).json({ error: 'كود التسجيل يجب أن يتكون من 8 أرقام' });
    return;
  }

  const db = getDb();
  let codeRecord = db.registration_codes.find((c) => c.code === cleanCode);

  if (!codeRecord) {
    await ensureDatabaseReady(true);
    codeRecord = db.registration_codes.find((c) => c.code === cleanCode);
  }

  if (!codeRecord) {
    res.status(404).json({ error: 'كود التسجيل غير صحيح أو غير موجود' });
    return;
  }

  if (codeRecord.used) {
    res.status(400).json({ error: 'تم استخدام هذا الكود بالفعل مسبقاً لتسجيل جهاز آخر' });
    return;
  }

  const now = Date.now();
  const expiresAt = new Date(codeRecord.expires_at).getTime();
  if (now > expiresAt) {
    res.status(400).json({ error: 'انتهت صلاحية هذا الكود (صلاحية الكود 5 دقائق فقط). اطلب من الإدارة توليد كود جديد.' });
    return;
  }

  // Generate a cryptographically secure random token (64 hex characters)
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const newDevice: ScannerDevice = {
    id: deviceId,
    church_id: codeRecord.church_id,
    name: cleanName,
    device_token: deviceToken,
    is_active: true,
    registered_at: nowIso,
    total_scans: 0,
    registered_with_code: cleanCode,
  };

  codeRecord.used = true;
  codeRecord.used_at = nowIso;
  codeRecord.used_by_device_name = cleanName;

  await createScannerDeviceAtomic(newDevice);
  saveLocalDatabaseOnly();

  logAudit({
    username: 'TRUSTED_DEVICE',
    churchId: codeRecord.church_id,
    action: 'SCANNER_DEVICE_REGISTERED',
    targetType: 'SCANNER',
    targetId: deviceId,
    targetName: cleanName,
    description: `تم تسجيل جهاز سكانر موثوق جديد بنجاح: (${cleanName}) بكود (${cleanCode})`,
    ipAddress: ip,
  });

  res.json({
    success: true,
    message: 'تم تسجيل الجهاز وتوثيقه بنجاح!',
    device_token: deviceToken,
    device: {
      id: newDevice.id,
      name: newDevice.name,
      is_active: newDevice.is_active,
      registered_at: newDevice.registered_at,
    },
  });
});

// 3. Verify device token (called on app startup by trusted phone)
scannerRouter.post('/verify-token', async (req: Request, res: Response) => {
  const token = req.body.device_token || req.headers['x-device-token'];
  if (!token) {
    res.status(401).json({ error: 'لم يتم توفير توكن الجهاز' });
    return;
  }

  const db = getDb();
  let device = db.scanner_devices.find((d) => d.device_token === token);

  // If not found in current instance memory, force re-sync from Firestore to pick up newly registered device
  if (!device) {
    await ensureDatabaseReady(true);
    device = db.scanner_devices.find((d) => d.device_token === token);
  }

  if (!device) {
    res.status(401).json({ error: 'الجهاز غير مسجل أو التوكن غير صالح' });
    return;
  }

  if (!device.is_active) {
    res.status(403).json({ error: 'تم تعطيل صلاحية هذا الجهاز من قبل الإدارة' });
    return;
  }

  res.json({
    valid: true,
    device: {
      id: device.id,
      name: device.name,
      is_active: device.is_active,
      registered_at: device.registered_at,
      total_scans: device.total_scans,
      last_used_at: device.last_used_at,
    },
  });
});

// 4. List all scanner devices (Admin)
scannerRouter.get(
  '/devices',
  authenticateJwt,
  requirePermission('manage_scanner', 'full_access'),
  async (req: AuthenticatedRequest, res: Response) => {
    // Ensure we fetch latest device scans and status from Firestore
    await ensureDatabaseReady(true);
    const db = getDb();
    const churchId = getEffectiveChurchId(req);
    let devices = db.scanner_devices;
    if (churchId) {
      devices = devices.filter((d) => !d.church_id || d.church_id === churchId);
    }
    const safeDevices = devices.map((d) => {
      const { device_token, ...rest } = d;
      return rest;
    });

    res.json({
      success: true,
      devices: safeDevices,
    });
  }
);

// 5. Toggle scanner device active/disabled (Admin)
scannerRouter.patch(
  '/devices/:id/toggle',
  authenticateJwt,
  requirePermission('manage_scanner', 'full_access'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const db = getDb();
    const device = db.scanner_devices.find((d) => d.id === req.params.id);

    if (!device) {
      res.status(404).json({ error: 'الجهاز غير موجود' });
      return;
    }

    const newActiveState = !device.is_active;
    await updateScannerDeviceAtomic(device.id, { is_active: newActiveState });

    logAudit({
      userId: user.id,
      username: user.username,
      action: device.is_active ? 'SCANNER_DEVICE_ENABLED' : 'SCANNER_DEVICE_REVOKED',
      targetType: 'SCANNER',
      targetId: device.id,
      targetName: device.name,
      description: `قام (${user.name}) بـ ${device.is_active ? 'تفعيل' : 'تعطيل وسحب الثقة من'} جهاز السكانر (${device.name})`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      is_active: device.is_active,
      message: device.is_active ? 'تم تفعيل الجهاز' : 'تم سحب الثقة وتعطيل الجهاز بنجاح',
    });
  }
);

// 6. Delete scanner device (Admin)
scannerRouter.delete(
  '/devices/:id',
  authenticateJwt,
  requirePermission('manage_scanner', 'full_access'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const db = getDb();
    const index = db.scanner_devices.findIndex((d) => d.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'الجهاز غير موجود' });
      return;
    }

    const device = db.scanner_devices[index];
    await deleteScannerDeviceAtomic(device.id);

    logAudit({
      userId: user.id,
      username: user.username,
      action: 'SCANNER_DEVICE_DELETED',
      targetType: 'SCANNER',
      targetId: device.id,
      targetName: device.name,
      description: `قام (${user.name}) بحذف جهاز السكانر (${device.name}) من النظام نهائياً`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: 'تم حذف الجهاز بنجاح' });
  }
);

// 7. Core QR Scan Attendance Endpoint for General Servants Meeting (اجتماع الخدام العام)
const handleScanAttendance = async (req: Request, res: Response) => {
  const token = req.body.device_token || req.headers['x-device-token'];
  const { qr_data } = req.body;
  const ip = getClientIp(req);

  if (!token) {
    res.status(401).json({ error: 'رمز الجهاز مفقود. يرجى استخدام جهاز مسجل وموثوق.' });
    return;
  }

  const db = getDb();
  let device = db.scanner_devices.find((d) => d.device_token === token);

  if (!device) {
    await ensureDatabaseReady(true);
    device = db.scanner_devices.find((d) => d.device_token === token);
  }

  if (!device) {
    res.status(403).json({ error: 'هذا الجهاز غير موثوق به لتسجيل الحضور. يرجى تسجيل الجهاز أولاً بكود من الإدارة.' });
    return;
  }

  if (!device.is_active) {
    res.status(403).json({ error: 'تم إيقاف صلاحية هذا الجهاز من قبل الإدارة. يرجى مراجعة أبونا أو إدارة الخدمة.' });
    return;
  }

  if (!qr_data) {
    res.status(400).json({ error: 'لم يتم استلام بيانات QR' });
    return;
  }

  // Parse QR content: could be raw servant id, national_id, or JSON
  let rawStr = String(qr_data).trim();
  let servantId = rawStr;
  let nationalId = '';

  try {
    if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
      const parsed = JSON.parse(rawStr);
      if (parsed.servant_id) servantId = parsed.servant_id;
      if (parsed.id) servantId = parsed.id;
      if (parsed.national_id) nationalId = parsed.national_id;
    }
  } catch {
    // raw string
  }

  // Search servant by ID or national ID or phone strictly within the scanner device's church
  const deviceChurchId = device.church_id;
  const servant = db.servants.find(
    (s) =>
      (!deviceChurchId || s.church_id === deviceChurchId) &&
      (s.id === servantId ||
        s.national_id === servantId ||
        (nationalId && s.national_id === nationalId) ||
        s.phone === servantId)
  );

  if (!servant) {
    res.status(404).json({
      error: 'رمز الكارنيه غير صالح: لم يتم العثور على خادم مسجل بهذه البيانات في هذه الكنيسة.',
    });
    return;
  }

  const srv = db.services.find((s) => s.id === servant.current_service_id);
  const serviceName = srv ? srv.name_ar : 'غير محدد';
  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  // Format time for Arabic display using Egypt Cairo Timezone (UTC+2 / UTC+3)
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('ar-EG', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  // CHECK PRIEST EXEMPTION: Priests are not tracked for attendance or absence
  if (isServantPriest(servant)) {
    res.json({
      success: true,
      action_type: 'priest_exempt',
      message: `قدس أبونا (${servant.full_name}) معفى من تسجيل الحضور والغياب (حفظه الله ورعاه). نطلب صلواتكم وبركتكم.`,
      servant: {
        id: servant.id,
        full_name: servant.full_name,
        phone: servant.phone,
        service_name: serviceName,
        current_role: servant.current_role || 'أب كاهن',
        profile_photo: servant.profile_photo,
      },
      is_priest: true,
      time: formatTime(nowIso),
      device_name: device.name,
    });
    return;
  }

  // Ensure meetings list exists
  if (!db.general_meetings) {
    db.general_meetings = [];
  }

  // Find or automatically initiate today's meeting on first scan
  const effectiveChurchId = device.church_id || servant.church_id;
  let meeting = db.general_meetings.find(
    (m) => m.date === today && m.status !== 'cancelled' && (!effectiveChurchId || !m.church_id || m.church_id === effectiveChurchId)
  );

  // If not found in local memory, check remote Firestore meta document to prevent duplicate auto-creation across instances
  if (!meeting && firestoreDb) {
    try {
      const metaSnap = await getDoc(doc(firestoreDb, 'system_data', 'meta'));
      if (metaSnap.exists()) {
        const remoteMeetings: GeneralMeeting[] = metaSnap.data()?.items?.general_meetings || [];
        const remoteFound = remoteMeetings.find(
          (m) => m.date === today && m.status !== 'cancelled' && (!effectiveChurchId || !m.church_id || m.church_id === effectiveChurchId)
        );
        if (remoteFound) {
          meeting = remoteFound;
          if (!db.general_meetings.some((m) => m.id === meeting!.id)) {
            db.general_meetings.push(meeting);
          }
        }
      }
    } catch (e) {
      console.warn('Could not check remote meta for meetings:', e);
    }
  }

  if (!meeting) {
    res.status(400).json({
      error: `لا يوجد اجتماع خدام مسجل لهذا اليوم (${today}). يرجى من أمين الخدمة أو المسؤول تسجيل موعد الاجتماع أولاً من شاشة "اجتماع الخدام" قبل بدء تسجيل الحضور.`,
    });
    return;
  }

  // Determine if current scan is after the late cutoff time (e.g. 13:00)
  // Format current Cairo/local time in HH:mm
  let currentHourMin = '';
  try {
    currentHourMin = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    const d = new Date();
    currentHourMin = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const cutoff = meeting.late_cutoff_time || '13:00';

  try {
    // ATOMIC FIRESTORE TRANSACTION:
    // Guarantees cross-instance concurrency protection, deterministic ID uniqueness,
    // and atomic scanner device scan counter increment.
    const result = await runScannerCheckinTransaction({
      meeting,
      servant,
      serviceName,
      device,
      today,
      nowIso,
      currentHourMin,
      cutoff,
      ip,
    });

    if (result.actionType === 'late_absent') {
      try {
        logAudit({
          username: device.name,
          action: 'MEETING_LATE_ABSENT',
          targetType: 'ATTENDANCE',
          targetId: servant.id,
          targetName: servant.full_name,
          description: `تم تسجيل الخادم (${servant.full_name}) "غياب" لتجاوزه آخر ميعاد للحضور (${cutoff}) الساعة ${formatTime(nowIso)}`,
          ipAddress: ip,
        });
      } catch (auditErr) {
        console.warn('Audit warning:', auditErr);
      }

      res.json({
        success: true,
        action_type: 'late_absent',
        warning: true,
        message: `⚠️ تنبيه: تجاوزت الساعة آخر موعد لتسجيل الحضور (${cutoff}). تم تسجيل الخادم (${servant.full_name}) "غياب" لتأخره عن موعد الاجتماع.`,
        meeting_title: meeting.title,
        cutoff_time: cutoff,
        servant: {
          id: servant.id,
          full_name: servant.full_name,
          phone: servant.phone,
          service_name: serviceName,
          current_role: servant.current_role,
          profile_photo: servant.profile_photo,
        },
        time: formatTime(nowIso),
        check_in_time: nowIso,
        device_name: device.name,
      });
      return;
    }

    if (result.actionType === 'check_in') {
      try {
        logAudit({
          username: device.name,
          churchId: meeting.church_id || device.church_id || servant.church_id,
          action: 'MEETING_CHECK_IN',
          targetType: 'ATTENDANCE',
          targetId: servant.id,
          targetName: servant.full_name,
          description: `تم تسجيل حضور الخادم (${servant.full_name}) في اجتماع الخدام العام (${meeting.title}) الساعة ${formatTime(nowIso)}`,
          ipAddress: ip,
        });
      } catch (auditErr) {
        console.warn('Audit warning:', auditErr);
      }

      res.json({
        success: true,
        action_type: 'check_in',
        message: `تم تسجيل حضور الخادم (${servant.full_name}) في اجتماع الخدام بنجاح الساعة ${formatTime(nowIso)}!`,
        meeting_title: meeting.title,
        cutoff_time: cutoff,
        servant: {
          id: servant.id,
          full_name: servant.full_name,
          phone: servant.phone,
          service_name: serviceName,
          current_role: servant.current_role,
          profile_photo: servant.profile_photo,
        },
        time: formatTime(nowIso),
        check_in_time: nowIso,
        device_name: device.name,
      });
      return;
    }

    if (result.actionType === 'duplicate_warning') {
      res.json({
        success: true,
        action_type: 'duplicate_warning',
        warning: true,
        message: `تنبيه: تم تسجيل هذا الخادم بالفعل منذ ${
          result.diffMinutes === 0 ? 'لحظات' : `${result.diffMinutes} دقيقة`
        }! (لا يمكن إعادة المسح في غضون 5 دقائق).`,
        meeting_title: meeting.title,
        servant: {
          id: servant.id,
          full_name: servant.full_name,
          phone: servant.phone,
          service_name: serviceName,
          current_role: servant.current_role,
          profile_photo: servant.profile_photo,
        },
        initial_check_in: result.record.check_in_time ? formatTime(result.record.check_in_time) : '',
        elapsed_minutes: result.diffMinutes,
        device_name: device.name,
      });
      return;
    }

    // CASE 3: Check-out
    try {
      logAudit({
        username: device.name,
        churchId: meeting.church_id || device.church_id || servant.church_id,
        action: 'MEETING_CHECK_OUT',
        targetType: 'ATTENDANCE',
        targetId: servant.id,
        targetName: servant.full_name,
        description: `تم تسجيل انصراف الخادم (${servant.full_name}) من اجتماع الخدام (${meeting.title}) بواسطة (${device.name}). مدة الحضور: ${result.durationText}`,
        ipAddress: ip,
      });
    } catch (auditErr) {
      console.warn('Audit warning:', auditErr);
    }

    res.json({
      success: true,
      action_type: 'check_out',
      message: `تم تسجيل انصراف الخادم (${servant.full_name}) بنجاح. مدة التواجد بالاجتماع: ${result.durationText}`,
      meeting_title: meeting.title,
      servant: {
        id: servant.id,
        full_name: servant.full_name,
        phone: servant.phone,
        service_name: serviceName,
        current_role: servant.current_role,
        profile_photo: servant.profile_photo,
      },
      check_in_time: result.record.check_in_time ? formatTime(result.record.check_in_time) : '',
      check_out_time: formatTime(nowIso),
      duration_minutes: result.diffMinutes,
      duration_text: result.durationText,
      device_name: device.name,
    });
  } catch (err: any) {
    console.error('Error in scanner quick-checkin transaction:', err);
    res.status(500).json({
      error: 'فشل إتمام عملية تسجيل الحضور بالسكانر: ' + (err?.message || 'خطأ غير معروف في المعاملة'),
    });
  }
};

scannerRouter.post('/scan', handleScanAttendance);
scannerRouter.post('/quick-checkin', handleScanAttendance);

// 8. General Meeting Attendance Records & Live Feed
scannerRouter.get(
  '/general-meeting',
  authenticateJwt,
  (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const date = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];
    const serviceId = req.query.service_id ? String(req.query.service_id) : '';

    let records = db.general_meeting_records.filter((r) => r.date === date);

    if (serviceId) {
      records = records.filter((r) => r.service_id === serviceId);
    }

    const totalAttended = records.length;
    const currentlyInMeeting = records.filter((r) => r.status === 'checked_in').length;
    const completedDeparture = records.filter((r) => r.status === 'completed').length;

    const totalDuration = records
      .filter((r) => r.duration_minutes !== undefined)
      .reduce((acc, r) => acc + (r.duration_minutes || 0), 0);
    const avgDuration =
      completedDeparture > 0 ? Math.round(totalDuration / completedDeparture) : 0;

    res.json({
      success: true,
      date,
      stats: {
        total_attended: totalAttended,
        currently_inside: currentlyInMeeting,
        completed_departure: completedDeparture,
        average_duration_minutes: avgDuration,
      },
      records: records.slice().reverse(),
    });
  }
);
