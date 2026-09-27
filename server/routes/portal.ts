import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { getClientIp } from '../auth.js';
import { logAudit } from '../audit.js';
import { ServantPortalData } from '../../src/types/index.js';

export const portalRouter = Router();

// Rate limiting in-memory map: IP -> { attempts: number, lockUntil: number }
const attemptsMap = new Map<string, { attempts: number; lockUntil: number }>();

portalRouter.post('/verify', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attemptInfo = attemptsMap.get(ip) || { attempts: 0, lockUntil: 0 };

  if (attemptInfo.lockUntil > now) {
    const remainingSeconds = Math.ceil((attemptInfo.lockUntil - now) / 1000);
    res.status(429).json({
      error: `تم تجاوز الحد الأقصى لمحاولات البحث. يرجى الانتظار لمدة ${remainingSeconds} ثانية للمحاولة مجدداً لأسباب أمنية.`,
      locked: true,
      remainingSeconds,
    });
    return;
  }

  const { national_id } = req.body;
  if (!national_id || typeof national_id !== 'string') {
    res.status(400).json({ error: 'يرجى إدخال الرقم القومي المكون من 14 رقماً' });
    return;
  }

  const cleanNationalId = national_id.trim();
  if (cleanNationalId.length < 10 || !/^\d+$/.test(cleanNationalId)) {
    res.status(400).json({ error: 'الرقم القومي غير صالح، يجب أن يتكون من أرقام فقط' });
    return;
  }

  const db = getDb();
  const servant = db.servants.find((s) => s.national_id === cleanNationalId);

  if (!servant) {
    attemptInfo.attempts += 1;
    if (attemptInfo.attempts >= 5) {
      attemptInfo.lockUntil = now + 5 * 60 * 1000; // lock for 5 minutes
    }
    attemptsMap.set(ip, attemptInfo);

    logAudit({
      username: 'GUEST_PORTAL',
      action: 'PORTAL_FAILED_SEARCH',
      targetType: 'SERVANT_PORTAL',
      description: 'محاولة بحث فاشلة برقم قومي غير مسجل في البوابة',
      ipAddress: ip,
    });

    res.status(400).json({
      success: false,
      error: 'خطأ في الرقم القومي أو غير مسجل بأي كنيسة',
    });
    return;
  }

  // Reset attempts on successful find
  attemptsMap.delete(ip);

  // Calculate real attendance metrics
  const records = db.attendance.filter((a) => a.servant_id === servant.id);
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const excused = records.filter((r) => r.status === 'excused').length;
  const total_meetings = records.length;
  const percentage = total_meetings > 0 ? Math.round((present / total_meetings) * 100) : 100;

  // Resolve current service name
  const currentService = db.services.find((s) => s.id === servant.current_service_id);

  // Resolve recent attendance logs
  const recent_attendance = records
    .slice(-15)
    .reverse()
    .map((r) => {
      const srv = db.services.find((s) => s.id === r.service_id);
      return {
        id: r.id,
        date: r.date,
        service_name: srv ? srv.name_ar : 'خدمة الكنيسة',
        status: r.status,
        notes: r.notes,
      };
    });

  // Resolve assignments history
  const assignments = db.assignments
    .filter((a) => a.servant_id === servant.id)
    .map((a) => {
      const srv = db.services.find((s) => s.id === a.service_id);
      return {
        service_name: srv ? srv.name_ar : 'خدمة الكنيسة',
        role: a.role,
        start_date: a.start_date,
        end_date: a.end_date,
        status: a.status,
      };
    });

  // Mask national ID (show first 6 and last 2)
  const masked_national_id =
    cleanNationalId.length >= 8
      ? `${cleanNationalId.slice(0, 6)}${'*'.repeat(cleanNationalId.length - 8)}${cleanNationalId.slice(-2)}`
      : '**************';

  // Find church information for this servant
  const church = servant.church_id ? db.churches?.find((c) => c.id === servant.church_id) : null;

  const portalData: ServantPortalData = {
    church: church
      ? {
          id: church.id,
          name: church.name,
          diocese: church.diocese,
          logo_url: church.logo_url,
          verse: church.verse,
        }
      : null,
    servant: {
      id: servant.id,
      full_name: servant.full_name,
      profile_photo: servant.profile_photo,
      current_service_name: currentService ? currentService.name_ar : 'غير محدد',
      current_role: servant.current_role,
      service_start_date: servant.service_start_date,
      joining_date: servant.joining_date,
      status: servant.status,
      masked_national_id,
      phone: servant.phone,
      gender: servant.gender,
    },
    attendance_stats: {
      total_meetings,
      present,
      absent,
      excused,
      percentage,
    },
    recent_attendance,
    assignments_history: assignments,
  };

  logAudit({
    username: 'SERVANT_PORTAL',
    action: 'PORTAL_VIEW_PROFILE',
    targetType: 'SERVANT',
    targetId: servant.id,
    targetName: servant.full_name,
    description: `قام الخادم (${servant.full_name}) بالاطلاع على حسابه ونسبة الحضور عبر بوابة الخدام`,
    ipAddress: ip,
  });

  res.json({ success: true, data: portalData });
});
