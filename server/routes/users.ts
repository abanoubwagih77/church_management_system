import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, saveDatabase, recordDeletedId } from '../db.js';
import { authenticateJwt, requirePermission, getEffectiveChurchId, getClientIp, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';
import { User, RoleType, PermissionKey } from '../../src/types/index.js';

export const usersRouter = Router();

usersRouter.use(authenticateJwt);

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleType, PermissionKey[]> = {
  super_admin: [
    'view_servants',
    'add_servant',
    'edit_servant',
    'delete_servant',
    'view_servant_details',
    'view_users',
    'add_user',
    'edit_user',
    'disable_user',
    'delete_user',
    'view_services',
    'add_service',
    'edit_service',
    'delete_service',
    'view_attendance',
    'add_attendance',
    'edit_attendance',
    'delete_attendance',
    'view_reports',
    'export_reports',
    'view_history',
    'manage_permissions',
    'manage_roles',
    'manage_scanner',
    'manage_church_settings',
    'full_access',
  ],
  church_admin: [
    'view_servants',
    'add_servant',
    'edit_servant',
    'delete_servant',
    'view_servant_details',
    'view_users',
    'add_user',
    'edit_user',
    'disable_user',
    'delete_user',
    'view_services',
    'add_service',
    'edit_service',
    'delete_service',
    'view_attendance',
    'add_attendance',
    'edit_attendance',
    'delete_attendance',
    'view_reports',
    'export_reports',
    'view_history',
    'manage_permissions',
    'manage_roles',
    'manage_scanner',
    'manage_church_settings',
    'full_access',
  ],
  priest: [
    'view_servants',
    'add_servant',
    'edit_servant',
    'delete_servant',
    'view_servant_details',
    'view_users',
    'add_user',
    'edit_user',
    'disable_user',
    'delete_user',
    'view_services',
    'add_service',
    'edit_service',
    'delete_service',
    'view_attendance',
    'add_attendance',
    'edit_attendance',
    'delete_attendance',
    'view_reports',
    'export_reports',
    'view_history',
    'manage_permissions',
    'manage_roles',
    'manage_scanner',
    'full_access',
  ],
  general_secretary: [
    'view_servants',
    'add_servant',
    'edit_servant',
    'view_servant_details',
    'view_users',
    'add_user',
    'edit_user',
    'view_services',
    'add_service',
    'edit_service',
    'view_attendance',
    'add_attendance',
    'edit_attendance',
    'view_reports',
    'export_reports',
    'view_history',
    'manage_scanner',
  ],
  stage_coordinator: [
    'view_servants',
    'edit_servant',
    'view_servant_details',
    'view_services',
    'view_attendance',
    'add_attendance',
    'edit_attendance',
    'view_reports',
  ],
  servant: [],
  captain: [
    'view_servants',
    'edit_servant',
    'view_servant_details',
    'view_services',
    'view_attendance',
    'add_attendance',
    'edit_attendance',
    'view_reports',
  ],
  manager: [
    'view_servants',
    'add_servant',
    'edit_servant',
    'view_services',
    'add_service',
    'view_attendance',
    'add_attendance',
    'view_reports',
    'export_reports',
  ],
  viewer: ['view_servants', 'view_services', 'view_attendance', 'view_reports'],
};

// GET /api/users - List users
usersRouter.get('/', requirePermission('view_users'), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  let userList = db.users;

  // Filter users by church
  if (currentUser.role !== 'super_admin') {
    userList = userList.filter((u) => u.church_id === currentUser.church_id);
  } else if (churchId) {
    userList = userList.filter((u) => !u.church_id || u.church_id === churchId);
  }

  const safeUsers = userList.map((u) => {
    const { password_hash, ...rest } = u;
    const linkedServant = u.linked_servant_id ? db.servants.find((s) => s.id === u.linked_servant_id) : undefined;
    const scopeService = u.scope !== 'all' ? db.services.find((s) => s.id === u.scope) : undefined;

    return {
      ...rest,
      linked_servant_name: linkedServant ? linkedServant.full_name : undefined,
      scope_service_name: scopeService ? scopeService.name_ar : 'كافة الخدمات (شامل)',
    };
  });

  res.json({ success: true, users: safeUsers });
});

// POST /api/users - Create user
usersRouter.post('/', requirePermission('add_user'), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  const { username, password, name, role, scope, permissions, linked_servant_id, church_role_title } = req.body;

  if (!username || !password || !name || !role) {
    res.status(400).json({ error: 'اسم المستخدم، كلمة المرور، الاسم الكامل، والدور حقول مطلوبة' });
    return;
  }

  const cleanUsername = String(username).trim().toLowerCase();
  if (cleanUsername.length < 3) {
    res.status(400).json({ error: 'اسم المستخدم يجب ألا يقل عن 3 أحرف' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' });
    return;
  }

  // Check unique username
  const exists = db.users.some((u) => u.username.toLowerCase() === cleanUsername);
  if (exists) {
    res.status(400).json({ error: 'اسم المستخدم هذا مسجل بالفعل' });
    return;
  }

  const roleType = role as RoleType;
  const userPermissions = Array.isArray(permissions) && permissions.length > 0
    ? permissions
    : DEFAULT_ROLE_PERMISSIONS[roleType] || DEFAULT_ROLE_PERMISSIONS.viewer;

  const nowIso = new Date().toISOString();
  const newUser: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    church_id: churchId || undefined,
    username: cleanUsername,
    name: name.trim(),
    role: roleType,
    church_role_title: church_role_title ? String(church_role_title).trim() : undefined,
    scope: scope || 'all',
    permissions: userPermissions,
    linked_servant_id: linked_servant_id || undefined,
    status: 'active',
    created_at: nowIso,
    updated_at: nowIso,
    password_hash: bcrypt.hashSync(password, 10),
  };

  db.users.push(newUser);
  saveDatabase();

  logAudit({
    userId: currentUser.id,
    username: currentUser.username,
    action: 'USER_CREATED',
    targetType: 'USER',
    targetId: newUser.id,
    targetName: newUser.name,
    description: `قام المستخدم (${currentUser.name}) بإنشاء حساب إداري جديد (${newUser.name} - @${newUser.username}) بدور (${newUser.role})`,
    ipAddress: getClientIp(req),
    changes: {
      after: {
        username: newUser.username,
        role: newUser.role,
        scope: newUser.scope,
      },
    },
  });

  const { password_hash, ...safeUser } = newUser;
  res.status(201).json({ success: true, user: safeUser });
});

// PUT /api/users/:id - Update user
usersRouter.put('/:id', requirePermission('edit_user'), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const db = getDb();
  const targetUser = db.users.find((u) => u.id === req.params.id);

  if (!targetUser) {
    res.status(404).json({ error: 'المستخدم غير موجود' });
    return;
  }

  // Prevent modifying the primary superadmin role unless superadmin or priest
  if (targetUser.role === 'super_admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'priest') {
    res.status(403).json({ error: 'لا يمكن تعديل حساب المدير العام إلا بواسطة أب كاهن أو مدير عام' });
    return;
  }

  const { name, role, scope, permissions, linked_servant_id, status, church_role_title } = req.body;

  const prevRole = targetUser.role;
  const prevPermissions = [...targetUser.permissions];
  const prevStatus = targetUser.status;

  if (name) targetUser.name = name.trim();
  if (role) targetUser.role = role as RoleType;
  if (church_role_title !== undefined) {
    const trimmed = String(church_role_title || '').trim();
    targetUser.church_role_title = trimmed.length > 0 ? trimmed : undefined;
  }
  if (scope !== undefined) targetUser.scope = scope;
  if (linked_servant_id !== undefined) targetUser.linked_servant_id = linked_servant_id || undefined;
  if (status) targetUser.status = status;

  let permissionsChanged = false;
  if (Array.isArray(permissions)) {
    // Check if changed
    if (JSON.stringify(permissions.sort()) !== JSON.stringify(prevPermissions.sort())) {
      permissionsChanged = true;
      targetUser.permissions = permissions;
    }
  }

  targetUser.updated_at = new Date().toISOString();
  saveDatabase();

  if (permissionsChanged) {
    logAudit({
      userId: currentUser.id,
      username: currentUser.username,
      action: 'PERMISSION_CHANGE',
      targetType: 'USER',
      targetId: targetUser.id,
      targetName: targetUser.name,
      description: `قام المستخدم (${currentUser.name}) بتعديل صلاحيات المستخدم (${targetUser.name})`,
      ipAddress: getClientIp(req),
      changes: {
        before: { permissions: prevPermissions },
        after: { permissions: targetUser.permissions },
      },
    });
  }

  if (status && status !== prevStatus) {
    logAudit({
      userId: currentUser.id,
      username: currentUser.username,
      action: status === 'disabled' ? 'USER_DISABLED' : 'USER_ENABLED',
      targetType: 'USER',
      targetId: targetUser.id,
      targetName: targetUser.name,
      description: `قام المستخدم (${currentUser.name}) بتغيير حالة حساب (${targetUser.name}) إلى (${status})`,
      ipAddress: getClientIp(req),
    });
  }

  logAudit({
    userId: currentUser.id,
    username: currentUser.username,
    action: 'USER_UPDATED',
    targetType: 'USER',
    targetId: targetUser.id,
    targetName: targetUser.name,
    description: `قام المستخدم (${currentUser.name}) بتحديث بيانات الحساب الإداري (${targetUser.name})`,
    ipAddress: getClientIp(req),
  });

  const { password_hash, ...safeUser } = targetUser;
  res.json({ success: true, user: safeUser });
});

// PATCH /api/users/:id/reset-password
usersRouter.patch('/:id/reset-password', requirePermission('edit_user'), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const db = getDb();
  const targetUser = db.users.find((u) => u.id === req.params.id);

  if (!targetUser) {
    res.status(404).json({ error: 'المستخدم غير موجود' });
    return;
  }

  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    res.status(400).json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' });
    return;
  }

  targetUser.password_hash = bcrypt.hashSync(new_password, 10);
  targetUser.updated_at = new Date().toISOString();
  saveDatabase();

  logAudit({
    userId: currentUser.id,
    username: currentUser.username,
    action: 'USER_RESET_PASSWORD',
    targetType: 'USER',
    targetId: targetUser.id,
    targetName: targetUser.name,
    description: `قام المستخدم (${currentUser.name}) بإعادة تعيين كلمة المرور للمستخدم (${targetUser.name})`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, message: 'تم تعيين كلمة المرور الجديدة بنجاح' });
});

// DELETE /api/users/:id
usersRouter.delete('/:id', requirePermission('delete_user'), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const db = getDb();

  if (req.params.id === currentUser.id) {
    res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به' });
    return;
  }

  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'المستخدم غير موجود' });
    return;
  }

  const targetUser = db.users[index];

  // Prevent deleting if it would leave the system without any Priest or Super Admin
  const hasOtherAdmin = db.users.some(
    (u) =>
      (u.role === 'super_admin' || u.role === 'priest') &&
      u.id !== targetUser.id &&
      u.status === 'active'
  );
  if (targetUser.role === 'super_admin' && !hasOtherAdmin) {
    res.status(400).json({ error: 'لا يمكن حذف الحساب: يجب أن يتبقى على الأقل حساب أب كاهن أو مدير عام نشط في النظام' });
    return;
  }

  recordDeletedId(targetUser.id);
  db.users.splice(index, 1);
  saveDatabase();

  logAudit({
    userId: currentUser.id,
    username: currentUser.username,
    action: 'USER_DELETED',
    targetType: 'USER',
    targetId: targetUser.id,
    targetName: targetUser.name,
    description: `قام المستخدم (${currentUser.name}) بحذف الحساب (${targetUser.name})`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
});

// POST /api/users/bulk-generate - Generate accounts for servants in bulk
usersRouter.post('/bulk-generate', requirePermission('add_user'), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const db = getDb();
  const { service_id, default_password_type, custom_password } = req.body;

  let targetServants = [...db.servants];
  if (service_id && service_id !== 'all') {
    targetServants = targetServants.filter((s) => s.current_service_id === service_id);
  }

  // Filter only servants without existing user accounts
  const servantsWithoutUsers = targetServants.filter(
    (s) => !db.users.some((u) => u.linked_servant_id === s.id)
  );

  if (servantsWithoutUsers.length === 0) {
    res.json({
      success: true,
      message: 'جميع الخدام في هذه المرحلة لديهم حسابات مستخدمين مسجلة بالفعل',
      created_count: 0,
      users: [],
    });
    return;
  }

  const generatedUsers: {
    servant_id: string;
    servant_name: string;
    service_name: string;
    username: string;
    initial_password: string;
    phone: string;
  }[] = [];

  const nowIso = new Date().toISOString();

  for (const servant of servantsWithoutUsers) {
    // Generate unique username based on phone or random
    const phoneTail = servant.phone.replace(/\D/g, '').slice(-6) || Math.floor(100000 + Math.random() * 900000).toString();
    let baseUsername = `servant_${phoneTail}`;
    let candidateUsername = baseUsername;
    let counter = 1;
    while (db.users.some((u) => u.username.toLowerCase() === candidateUsername.toLowerCase())) {
      candidateUsername = `${baseUsername}_${counter}`;
      counter++;
    }

    // Generate initial password
    let initialPassword = '';
    if (default_password_type === 'custom' && custom_password && custom_password.length >= 6) {
      initialPassword = custom_password;
    } else if (default_password_type === 'phone' && servant.phone) {
      initialPassword = servant.phone.slice(-6);
      if (initialPassword.length < 6) initialPassword = `stg_${Math.floor(100000 + Math.random() * 900000)}`;
    } else {
      // Random 6-digit PIN
      initialPassword = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const newUser: User = {
      id: `user_servant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: candidateUsername,
      name: servant.full_name,
      role: 'servant',
      scope: servant.current_service_id || 'all',
      permissions: [],
      linked_servant_id: servant.id,
      status: 'active',
      must_change_password: true, // Force change on first login!
      created_at: nowIso,
      updated_at: nowIso,
      password_hash: bcrypt.hashSync(initialPassword, 10),
    };

    db.users.push(newUser);

    const srv = db.services.find((s) => s.id === servant.current_service_id);
    generatedUsers.push({
      servant_id: servant.id,
      servant_name: servant.full_name,
      service_name: srv ? srv.name_ar : 'غير محدد',
      username: candidateUsername,
      initial_password: initialPassword,
      phone: servant.phone,
    });
  }

  saveDatabase();

  logAudit({
    userId: currentUser.id,
    username: currentUser.username,
    action: 'BULK_USERS_GENERATED',
    targetType: 'USER',
    description: `قام (${currentUser.name}) بتوليد حسابات دخول جديدة لعدد (${generatedUsers.length}) خادم مع تفعيل إلزام تغيير كلمة المرور عند أول دخول`,
    ipAddress: getClientIp(req),
  });

  res.json({
    success: true,
    message: `تم توليد (${generatedUsers.length}) حساب للخدام بنجاح!`,
    created_count: generatedUsers.length,
    users: generatedUsers,
  });
});
