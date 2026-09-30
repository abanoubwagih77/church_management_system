import { Router, Response } from 'express';
import { getDb, createServiceAtomic, updateServiceAtomic, deleteServiceAtomic } from '../db.js';
import { authenticateJwt, requirePermission, getEffectiveChurchId, getClientIp, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';
import { ChurchService } from '../../src/types/index.js';

export const servicesRouter = Router();

servicesRouter.use(authenticateJwt);

function normalizeServiceName(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

// GET /api/services - List services
servicesRouter.get('/', requirePermission('view_services'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  let services = [...db.services];

  if (churchId) {
    services = services.filter((s) => s.church_id === churchId);
  }

  // If user has scoped role, still return services for dropdowns, but can mark accessible
  const userScope = user.scope;

  const enriched = services.map((srv) => {
    const servantCount = db.servants.filter((s) => s.current_service_id === srv.id && s.status === 'active' && (!churchId || s.church_id === churchId)).length;
    const totalAttendance = db.attendance.filter((a) => a.service_id === srv.id).length;
    const presentAttendance = db.attendance.filter((a) => a.service_id === srv.id && a.status === 'present').length;
    const attendance_rate = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 100;

    return {
      ...srv,
      servants_count: servantCount,
      attendance_rate,
      accessible: user.role === 'super_admin' || user.role === 'church_admin' || userScope === 'all' || userScope === srv.id,
    };
  });

  res.json({ success: true, services: enriched });
});

// POST /api/services - Add service
servicesRouter.post('/', requirePermission('add_service'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const churchId = user.role === 'super_admin' ? getEffectiveChurchId(req) : user.church_id;
  const { name, name_ar, code, description, meeting_day, meeting_time } = req.body;

  if (!name_ar) {
    res.status(400).json({ error: 'اسم الخدمة بالعربية مطلوب' });
    return;
  }

  const cleanNameAr = name_ar.trim();
  const cleanCode = code ? code.trim().toUpperCase() : 'SRV';
  const normName = normalizeServiceName(cleanNameAr);

  // Check for duplicate service in this church
  const existingServices = db.services.filter((s) => !churchId || s.church_id === churchId);
  const duplicate = existingServices.find(
    (s) =>
      normalizeServiceName(s.name_ar) === normName ||
      (cleanCode && cleanCode !== 'SRV' && s.code?.trim().toUpperCase() === cleanCode)
  );

  if (duplicate) {
    res.status(400).json({
      error: `هذه المرحلة أو الخدمة مسجلة بالفعل في الكنيسة (${duplicate.name_ar})، لا يمكن تكرار نفس المرحلة.`,
    });
    return;
  }

  const newService: ChurchService = {
    id: `srvc_${Date.now()}`,
    church_id: churchId || undefined,
    name: name ? name.trim() : cleanNameAr,
    name_ar: cleanNameAr,
    code: cleanCode,
    description,
    meeting_day,
    meeting_time,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  try {
    await createServiceAtomic(newService);
  } catch (err: any) {
    console.error('Failed to create service in Firestore:', err);
    res.status(500).json({ error: 'فشل حفظ الخدمة في قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف') });
    return;
  }

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'SERVICE_CREATED',
    targetType: 'SERVICE',
    targetId: newService.id,
    targetName: newService.name_ar,
    description: `قام المستخدم (${user.name}) بإنشاء خدمة جديدة (${newService.name_ar})`,
    ipAddress: getClientIp(req),
  });

  res.status(201).json({ success: true, service: newService });
});

// PUT /api/services/:id - Update service
servicesRouter.put('/:id', requirePermission('edit_service'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const service = db.services.find((s) => s.id === req.params.id);

  if (!service) {
    res.status(404).json({ error: 'الخدمة غير موجودة' });
    return;
  }

  // Tenant Isolation: Non-super-admin users can only update services in their own church
  if (user.role !== 'super_admin' && service.church_id && user.church_id && service.church_id !== user.church_id) {
    res.status(403).json({ error: 'غير مصرح: لا يمكنك تعديل بيانات خدمة تابعة لكنيسة أخرى' });
    return;
  }

  const { name, name_ar, code, description, meeting_day, meeting_time, status } = req.body;

  // Check for duplicate service in this church excluding current service
  if (name_ar || code) {
    const targetNameAr = name_ar ? name_ar.trim() : service.name_ar;
    const targetCode = code ? code.trim().toUpperCase() : service.code;
    const normTargetName = normalizeServiceName(targetNameAr);

    const otherServices = db.services.filter(
      (s) => s.id !== service.id && (!service.church_id || s.church_id === service.church_id)
    );
    const duplicate = otherServices.find(
      (s) =>
        normalizeServiceName(s.name_ar) === normTargetName ||
        (targetCode && targetCode !== 'SRV' && s.code?.trim().toUpperCase() === targetCode)
    );

    if (duplicate) {
      res.status(400).json({
        error: `يوجد مرحلة أخرى مسجلة بالفعل في الكنيسة بهذا الاسم أو الكود (${duplicate.name_ar})`,
      });
      return;
    }
  }

  const before = { ...service };

  const updatedService: ChurchService = {
    ...service,
    name: name !== undefined ? name.trim() : service.name,
    name_ar: name_ar !== undefined ? name_ar.trim() : service.name_ar,
    code: code !== undefined ? code.trim().toUpperCase() : service.code,
    description: description !== undefined ? description : service.description,
    meeting_day: meeting_day !== undefined ? meeting_day : service.meeting_day,
    meeting_time: meeting_time !== undefined ? meeting_time : service.meeting_time,
    status: status || service.status,
  };

  try {
    await updateServiceAtomic(updatedService);
  } catch (err: any) {
    console.error('Failed to update service in Firestore:', err);
    res.status(500).json({ error: 'فشل تحديث بيانات الخدمة في قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف') });
    return;
  }

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'SERVICE_UPDATED',
    targetType: 'SERVICE',
    targetId: updatedService.id,
    targetName: updatedService.name_ar,
    description: `قام المستخدم (${user.name}) بتحديث بيانات خدمة (${updatedService.name_ar})`,
    ipAddress: getClientIp(req),
    changes: {
      before,
      after: { ...updatedService },
    },
  });

  res.json({ success: true, service: updatedService });
});

// DELETE /api/services/:id - Delete service
servicesRouter.delete('/:id', requirePermission('delete_service'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const index = db.services.findIndex((s) => s.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'الخدمة غير موجودة' });
    return;
  }

  const service = db.services[index];

  // Tenant Isolation: Non-super-admin users can only delete services in their own church
  if (user.role !== 'super_admin' && service.church_id && user.church_id && service.church_id !== user.church_id) {
    res.status(403).json({ error: 'غير مصرح: لا يمكنك حذف خدمة تابعة لكنيسة أخرى' });
    return;
  }

  // Check if servants are assigned to this service
  const assignedServants = db.servants.filter((s) => s.current_service_id === service.id);
  if (assignedServants.length > 0) {
    res.status(400).json({
      error: `لا يمكن حذف هذه الخدمة نظراً لوجود (${assignedServants.length}) خادم مسجلين بها. يرجى نقلهم لخدمة أخرى أولاً أو تعطيل الخدمة.`,
    });
    return;
  }

  try {
    await deleteServiceAtomic(service.id);
  } catch (err: any) {
    console.error('Failed to delete service in Firestore:', err);
    res.status(500).json({ error: 'فشل حذف الخدمة من قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف') });
    return;
  }

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'SERVICE_DELETED',
    targetType: 'SERVICE',
    targetId: service.id,
    targetName: service.name_ar,
    description: `قام المستخدم (${user.name}) بحذف خدمة (${service.name_ar})`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, message: 'تم حذف الخدمة بنجاح' });
});
