import { Router, Response } from 'express';
import { getDb, saveDatabase, saveDatabaseAsync, recordDeletedId } from '../db.js';
import { authenticateJwt, requirePermission, checkScopeAccess, getEffectiveChurchId, getClientIp, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';
import { Servant, ServiceAssignment } from '../../src/types/index.js';

export const servantsRouter = Router();

// Apply auth to all servants endpoints
servantsRouter.use(authenticateJwt);

// GET /api/servants - List and filter servants
servantsRouter.get('/', requirePermission('view_servants'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  let servants = [...db.servants];

  // Filter by church tenant
  if (churchId) {
    servants = servants.filter((s) => s.church_id === churchId);
  } else if (user.role !== 'super_admin') {
    servants = [];
  }

  // Apply scope restriction (e.g. Service Leader only sees their service)
  if (user.role !== 'super_admin' && user.scope !== 'all') {
    servants = servants.filter((s) => s.current_service_id === user.scope);
  }

  // Search filter
  const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
  if (q) {
    const canViewNationalId = user.role === 'super_admin' || user.permissions.includes('view_servant_details');
    servants = servants.filter((s) => {
      const nameMatch = s.full_name.toLowerCase().includes(q);
      const phoneMatch = s.phone.includes(q);
      const roleMatch = s.current_role.toLowerCase().includes(q);
      const nationalIdMatch = canViewNationalId && s.national_id.includes(q);
      return nameMatch || phoneMatch || roleMatch || nationalIdMatch;
    });
  }

  // Filters
  const serviceId = req.query.service_id ? String(req.query.service_id) : '';
  if (serviceId) {
    servants = servants.filter((s) => s.current_service_id === serviceId);
  }

  const status = req.query.status ? String(req.query.status) : '';
  if (status) {
    servants = servants.filter((s) => s.status === status);
  }

  const gender = req.query.gender ? String(req.query.gender) : '';
  if (gender) {
    servants = servants.filter((s) => s.gender === gender);
  }

  const role = req.query.role ? String(req.query.role) : '';
  if (role) {
    servants = servants.filter((s) => s.current_role === role);
  }

  // Map with service name and attendance percentage
  const canViewSensitive = user.role === 'super_admin' || user.permissions.includes('view_servant_details');

  const enrichedServants = servants.map((s) => {
    const srv = db.services.find((sv) => sv.id === s.current_service_id);
    const records = db.attendance.filter((a) => a.servant_id === s.id);
    const present = records.filter((r) => r.status === 'present').length;
    const total = records.length;
    const attendance_rate = total > 0 ? Math.round((present / total) * 100) : 100;

    return {
      ...s,
      service_name: srv ? srv.name_ar : 'غير محدد',
      attendance_rate,
      total_meetings: total,
      national_id: canViewSensitive
        ? s.national_id
        : `${s.national_id.slice(0, 4)}******${s.national_id.slice(-2)}`,
      // Remove ID card photo from bulk list for performance and security
      id_card_photo: s.id_card_photo ? true : false,
    };
  });

  res.json({
    success: true,
    total: enrichedServants.length,
    servants: enrichedServants,
  });
});

// GET /api/servants/:id - Servant Detail
servantsRouter.get('/:id', requirePermission('view_servants'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const servant = db.servants.find((s) => s.id === req.params.id);

  if (!servant) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  if (!checkScopeAccess(user, servant.current_service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية للوصول لبيانات هذا الخادم في هذه الخدمة' });
    return;
  }

  const canViewSensitive = user.role === 'super_admin' || user.permissions.includes('view_servant_details');

  // Attendance metrics
  const records = db.attendance.filter((a) => a.servant_id === servant.id);
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const excused = records.filter((r) => r.status === 'excused').length;
  const total = records.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

  // Assignments History
  const assignments = db.assignments
    .filter((a) => a.servant_id === servant.id)
    .map((a) => {
      const srv = db.services.find((s) => s.id === a.service_id);
      return {
        ...a,
        service_name: srv ? srv.name_ar : 'خدمة',
      };
    });

  // Recent attendance
  const recentAttendance = records.slice(-20).reverse().map((r) => {
    const srv = db.services.find((s) => s.id === r.service_id);
    return {
      ...r,
      service_name: srv ? srv.name_ar : 'الخدمة',
    };
  });

  const currentService = db.services.find((s) => s.id === servant.current_service_id);

  res.json({
    success: true,
    servant: {
      ...servant,
      national_id: canViewSensitive
        ? servant.national_id
        : `${servant.national_id.slice(0, 4)}******${servant.national_id.slice(-2)}`,
      current_service_name: currentService ? currentService.name_ar : 'غير محدد',
    },
    attendance_stats: {
      total,
      present,
      absent,
      excused,
      percentage,
    },
    assignments,
    recent_attendance: recentAttendance,
    has_id_card: Boolean(servant.id_card_photo),
  });
});

// POST /api/servants - Add a new servant
servantsRouter.post('/', requirePermission('add_servant'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const {
    full_name,
    national_id,
    date_of_birth,
    gender,
    phone,
    email,
    address,
    profile_photo,
    id_card_photo,
    joining_date,
    service_start_date,
    current_service_id,
    current_role,
    notes,
  } = req.body;

  if (!full_name || !national_id || !phone) {
    res.status(400).json({ error: 'الاسم بالكامل، الرقم القومي، ورقم الهاتف حقول مطلوبة' });
    return;
  }

  const cleanNationalId = String(national_id).trim();
  if (cleanNationalId.length < 10 || !/^\d+$/.test(cleanNationalId)) {
    res.status(400).json({ error: 'الرقم القومي غير صالح، يجب أن يتكون من أرقام فقط' });
    return;
  }

  // Check uniqueness
  const churchId = getEffectiveChurchId(req) || req.body.church_id || user.church_id;
  const exists = db.servants.some((s) => s.national_id === cleanNationalId && (!churchId || s.church_id === churchId));
  if (exists) {
    res.status(400).json({ error: 'يوجد خادم مسجل بالفعل بنفس هذا الرقم القومي في هذه الكنيسة' });
    return;
  }

  // Check scope
  if (current_service_id && !checkScopeAccess(user, current_service_id)) {
    res.status(403).json({ error: 'لا يمكنك إضافة خادم في خدمة خارج نطاق صلاحياتك المحددة' });
    return;
  }

  const newServantId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const newServant: Servant = {
    id: newServantId,
    church_id: churchId || undefined,
    full_name: full_name.trim(),
    national_id: cleanNationalId,
    date_of_birth: date_of_birth || '',
    gender: gender === 'female' ? 'female' : 'male',
    phone: phone.trim(),
    email: email ? email.trim() : undefined,
    address: address ? address.trim() : undefined,
    profile_photo,
    id_card_photo,
    joining_date: joining_date || nowIso.split('T')[0],
    service_start_date: service_start_date || nowIso.split('T')[0],
    current_service_id: current_service_id || undefined,
    current_role: current_role || 'خادم',
    status: 'active',
    notes,
    created_at: nowIso,
    updated_at: nowIso,
  };

  db.servants.push(newServant);

  // If assigned to a service, create an assignment record
  if (current_service_id) {
    const assignment: ServiceAssignment = {
      id: `assign_${Date.now()}`,
      church_id: churchId || undefined,
      servant_id: newServantId,
      service_id: current_service_id,
      role: current_role || 'خادم',
      start_date: service_start_date || nowIso.split('T')[0],
      status: 'active',
      created_at: nowIso,
    };
    db.assignments.push(assignment);
  }

  await saveDatabaseAsync();

  const srvName = db.services.find((s) => s.id === current_service_id)?.name_ar || 'الكنيسة';

  logAudit({
    userId: user.id,
    username: user.username,
    churchId: churchId,
    action: 'CREATE_SERVANT',
    targetType: 'SERVANT',
    targetId: newServant.id,
    targetName: newServant.full_name,
    description: `قام المستخدم (${user.name}) بإضافة خادم جديد (${newServant.full_name}) في (${srvName})`,
    ipAddress: getClientIp(req),
    changes: {
      after: {
        full_name: newServant.full_name,
        phone: newServant.phone,
        service: srvName,
        role: newServant.current_role,
      },
    },
  });

  res.status(201).json({ success: true, servant: newServant });
});

// PUT /api/servants/:id - Edit servant
servantsRouter.put('/:id', requirePermission('edit_servant'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const servantIndex = db.servants.findIndex((s) => s.id === req.params.id);

  if (servantIndex === -1) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  const existing = db.servants[servantIndex];

  if (!checkScopeAccess(user, existing.current_service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لتعديل خادم في هذه الخدمة' });
    return;
  }

  const {
    full_name,
    national_id,
    date_of_birth,
    gender,
    phone,
    email,
    address,
    profile_photo,
    id_card_photo,
    joining_date,
    service_start_date,
    current_service_id,
    current_role,
    status,
    notes,
  } = req.body;

  if (current_service_id && !checkScopeAccess(user, current_service_id)) {
    res.status(403).json({ error: 'لا يمكنك نقل الخادم لخدمة خارج نطاق صلاحياتك' });
    return;
  }

  // Check national ID change
  if (national_id) {
    const cleanNationalId = String(national_id).trim();
    if (cleanNationalId !== existing.national_id) {
      const exists = db.servants.some((s) => s.id !== existing.id && s.national_id === cleanNationalId);
      if (exists) {
        res.status(400).json({ error: 'يوجد خادم آخر مسجل بنفس هذا الرقم القومي' });
        return;
      }
      existing.national_id = cleanNationalId;
    }
  }

  const nowIso = new Date().toISOString();

  // Handle service change in assignments history
  if (current_service_id && current_service_id !== existing.current_service_id) {
    // End active assignments
    db.assignments
      .filter((a) => a.servant_id === existing.id && a.status === 'active')
      .forEach((a) => {
        a.status = 'past';
        a.end_date = nowIso.split('T')[0];
      });

    // Create new assignment
    db.assignments.push({
      id: `assign_${Date.now()}`,
      servant_id: existing.id,
      service_id: current_service_id,
      role: current_role || existing.current_role,
      start_date: nowIso.split('T')[0],
      status: 'active',
      created_at: nowIso,
    });
  }

  const beforeState = {
    full_name: existing.full_name,
    phone: existing.phone,
    role: existing.current_role,
    status: existing.status,
    service_id: existing.current_service_id,
  };

  existing.full_name = full_name ? full_name.trim() : existing.full_name;
  existing.date_of_birth = date_of_birth !== undefined ? date_of_birth : existing.date_of_birth;
  existing.gender = gender ? (gender === 'female' ? 'female' : 'male') : existing.gender;
  existing.phone = phone ? phone.trim() : existing.phone;
  existing.email = email !== undefined ? email.trim() : existing.email;
  existing.address = address !== undefined ? address.trim() : existing.address;
  if (profile_photo !== undefined) existing.profile_photo = profile_photo;
  if (id_card_photo !== undefined) existing.id_card_photo = id_card_photo;
  existing.joining_date = joining_date !== undefined ? joining_date : existing.joining_date;
  existing.service_start_date = service_start_date !== undefined ? service_start_date : existing.service_start_date;
  existing.current_service_id = current_service_id !== undefined ? current_service_id : existing.current_service_id;
  existing.current_role = current_role ? current_role : existing.current_role;
  existing.status = status ? (status === 'inactive' ? 'inactive' : 'active') : existing.status;
  existing.notes = notes !== undefined ? notes : existing.notes;
  existing.updated_at = nowIso;

  await saveDatabaseAsync();

  const churchId = existing.church_id || getEffectiveChurchId(req);

  logAudit({
    userId: user.id,
    username: user.username,
    churchId: churchId,
    action: 'UPDATE_SERVANT',
    targetType: 'SERVANT',
    targetId: existing.id,
    targetName: existing.full_name,
    description: `قام المستخدم (${user.name}) بتحديث بيانات الخادم (${existing.full_name})`,
    ipAddress: getClientIp(req),
    changes: {
      before: beforeState,
      after: {
        full_name: existing.full_name,
        phone: existing.phone,
        role: existing.current_role,
        status: existing.status,
        service_id: existing.current_service_id,
      },
    },
  });

  res.json({ success: true, servant: existing });
});

// PATCH /api/servants/:id/status - Toggle active/inactive
servantsRouter.patch('/:id/status', requirePermission('edit_servant'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const servant = db.servants.find((s) => s.id === req.params.id);

  if (!servant) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  if (!checkScopeAccess(user, servant.current_service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لتعديل حالة هذا الخادم' });
    return;
  }

  const prevStatus = servant.status;
  servant.status = servant.status === 'active' ? 'inactive' : 'active';
  servant.updated_at = new Date().toISOString();
  await saveDatabaseAsync();

  const churchId = servant.church_id || getEffectiveChurchId(req);

  logAudit({
    userId: user.id,
    username: user.username,
    churchId: churchId,
    action: 'SERVANT_STATUS_CHANGE',
    targetType: 'SERVANT',
    targetId: servant.id,
    targetName: servant.full_name,
    description: `قام المستخدم (${user.name}) بتغيير حالة الخادم (${servant.full_name}) من (${prevStatus}) إلى (${servant.status})`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, status: servant.status });
});

// DELETE /api/servants/:id - Delete servant
servantsRouter.delete('/:id', requirePermission('delete_servant'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const index = db.servants.findIndex((s) => s.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  const servant = db.servants[index];

  if (!checkScopeAccess(user, servant.current_service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية لحذف هذا الخادم' });
    return;
  }

  const churchId = servant.church_id || getEffectiveChurchId(req);

  // Remove servant
  recordDeletedId(servant.id);
  db.servants.splice(index, 1);
  // Also clean up their assignments & attendance
  db.assignments = db.assignments.filter((a) => a.servant_id !== servant.id);
  db.attendance = db.attendance.filter((a) => a.servant_id !== servant.id);

  await saveDatabaseAsync();

  logAudit({
    userId: user.id,
    username: user.username,
    churchId: churchId,
    action: 'DELETE_SERVANT',
    targetType: 'SERVANT',
    targetId: servant.id,
    targetName: servant.full_name,
    description: `قام المستخدم (${user.name}) بحذف سجل الخادم (${servant.full_name}) نهائياً`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, message: 'تم حذف الخادم بنجاح' });
});

// GET /api/servants/:id/id-card - Secure ID card photo retrieval
servantsRouter.get('/:id/id-card', requirePermission('view_servant_details'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const servant = db.servants.find((s) => s.id === req.params.id);

  if (!servant) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  if (!checkScopeAccess(user, servant.current_service_id)) {
    res.status(403).json({ error: 'ليس لديك صلاحية للاطلاع على بطاقة هذا الخادم' });
    return;
  }

  if (!servant.id_card_photo) {
    res.status(404).json({ error: 'لا توجد صورة بطاقة رقم قومي مرفوعة لهذا الخادم' });
    return;
  }

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'VIEW_ID_CARD',
    targetType: 'SERVANT',
    targetId: servant.id,
    targetName: servant.full_name,
    description: `قام المستخدم (${user.name}) بعرض صورة بطاقة الرقم القومي للخادم (${servant.full_name})`,
    ipAddress: getClientIp(req),
  });

  res.json({
    success: true,
    photo: servant.id_card_photo,
    servant_name: servant.full_name,
  });
});

// POST /api/servants/:id/transfer - Transfer servant to new service/stage for new Coptic year
servantsRouter.post('/:id/transfer', requirePermission('edit_servant'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const servant = db.servants.find((s) => s.id === req.params.id);

  if (!servant) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  const { new_service_id, new_role, coptic_year, notes, start_date } = req.body;

  if (!new_service_id) {
    res.status(400).json({ error: 'يرجى تحديد الخدمة أو المرحلة الجديدة المراد النقل إليها' });
    return;
  }

  const oldService = db.services.find((s) => s.id === servant.current_service_id);
  const newService = db.services.find((s) => s.id === new_service_id);

  if (!newService) {
    res.status(404).json({ error: 'المرحلة أو الخدمة الجديدة غير موجودة' });
    return;
  }

  const nowIso = new Date().toISOString();
  const transferStartDate = start_date || nowIso.split('T')[0];

  // 1. Mark current active assignment as past
  db.assignments.forEach((a) => {
    if (a.servant_id === servant.id && a.status === 'active') {
      a.status = 'past';
      a.end_date = transferStartDate;
    }
  });

  // 2. Create new assignment
  const roleName = new_role ? String(new_role).trim() : servant.current_role;
  const newAssignment: ServiceAssignment = {
    id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    servant_id: servant.id,
    service_id: new_service_id,
    role: roleName,
    coptic_year: coptic_year || 'العام الجديد',
    start_date: transferStartDate,
    status: 'active',
    notes: notes || undefined,
    created_at: nowIso,
  };
  db.assignments.push(newAssignment);

  // 3. Update servant's current stage and role
  const prevServiceId = servant.current_service_id;
  const prevRole = servant.current_role;
  servant.current_service_id = new_service_id;
  servant.current_role = roleName;
  servant.updated_at = nowIso;

  // 4. If this servant has a linked user account with role 'stage_coordinator', update scope automatically
  const linkedUser = db.users.find((u) => u.linked_servant_id === servant.id);
  if (linkedUser && linkedUser.role === 'stage_coordinator') {
    linkedUser.scope = new_service_id;
    linkedUser.updated_at = nowIso;
  }

  saveDatabase();

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'SERVANT_TRANSFERRED',
    targetType: 'SERVANT',
    targetId: servant.id,
    targetName: servant.full_name,
    description: `قام (${user.name}) بنقل الخادم (${servant.full_name}) من (${oldService ? oldService.name_ar : 'غير محدد'}) إلى (${newService.name_ar}) لدور (${roleName}) للسنة القبطية (${coptic_year || 'الجديدة'})`,
    ipAddress: getClientIp(req),
    changes: {
      before: { service_id: prevServiceId, role: prevRole },
      after: { service_id: new_service_id, role: roleName, coptic_year },
    },
  });

  res.json({
    success: true,
    message: `تم نقل الخادم إلى (${newService.name_ar}) وحفظ السجل في تاريخ الخدمة بنجاح`,
    servant,
    assignment: newAssignment,
  });
});

// GET /api/servants/:id/history - Get complete multi-year service history
servantsRouter.get('/:id/history', requirePermission('view_servants'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const servant = db.servants.find((s) => s.id === req.params.id);

  if (!servant) {
    res.status(404).json({ error: 'الخادم غير موجود' });
    return;
  }

  const assignments = db.assignments
    .filter((a) => a.servant_id === servant.id)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .map((a) => {
      const srv = db.services.find((s) => s.id === a.service_id);
      return {
        ...a,
        service_name: srv ? srv.name_ar : 'خدمة محذوفة',
      };
    });

  res.json({
    success: true,
    servant_id: servant.id,
    servant_name: servant.full_name,
    history: assignments,
  });
});
