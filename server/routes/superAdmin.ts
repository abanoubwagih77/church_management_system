import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  getDb,
  saveDatabase,
  saveDatabaseAsync,
  getCloudSyncInfo,
  pushToFirestoreImmediate,
  syncFromFirestore,
  recordDeletedId,
  saveLocalDatabaseOnly,
  createUserAtomic,
  updateUserAtomic,
  deleteUserAtomic,
  updateUserPasswordAtomic,
  updateUserFaceAtomic,
  deleteServantAtomic,
  deleteServiceAtomic,
  createChurchAtomic,
  updateChurchAtomic,
  deleteChurchAtomic,
} from '../db.js';
import { authenticateJwt, requireSuperAdmin, AuthenticatedRequest, sanitizeUser } from '../auth.js';
import { logAudit } from '../audit.js';
import { Church, User, ChurchStatus, PermissionKey } from '../../src/types/index.js';

export const superAdminRouter = Router();

// Apply super_admin guard to all routes here
superAdminRouter.use(authenticateJwt, requireSuperAdmin);

// GET /api/super-admin/stats - Global platform statistics
superAdminRouter.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const churches = db.churches || [];
    const servants = db.servants || [];
    const users = db.users || [];

    const activeChurches = churches.filter((c) => c.status === 'active').length;
    const inactiveChurches = churches.filter((c) => c.status === 'inactive').length;
    const suspendedChurches = churches.filter((c) => c.status === 'suspended').length;
    const trialChurches = churches.filter((c) => c.status === 'trial').length;

    const churchAdminsCount = users.filter((u) => u.role === 'church_admin').length;

    res.json({
      total_churches: churches.length,
      active_churches: activeChurches,
      inactive_churches: inactiveChurches,
      suspended_churches: suspendedChurches,
      trial_churches: trialChurches,
      total_church_admins: churchAdminsCount,
      total_servants: servants.length,
      total_users: users.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب إحصائيات المنصة' });
  }
});

// GET /api/super-admin/churches - List all churches with summary stats
superAdminRouter.get('/churches', (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const churches = db.churches || [];
    const servants = db.servants || [];
    const users = db.users || [];

    const churchesWithStats = churches.map((church) => {
      const churchServants = servants.filter((s) => s.church_id === church.id);
      const churchUsers = users.filter((u) => u.church_id === church.id);
      const primaryAdmin = users.find((u) => u.id === church.primary_admin_id || (u.church_id === church.id && u.role === 'church_admin'));

      return {
        ...church,
        servants_count: churchServants.length,
        users_count: churchUsers.length,
        admin_info: primaryAdmin
          ? {
              id: primaryAdmin.id,
              name: primaryAdmin.name,
              username: primaryAdmin.username,
              status: primaryAdmin.status,
              password_hint: primaryAdmin.plain_password_hint || null,
            }
          : null,
      };
    });

    res.json({ churches: churchesWithStats });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب قائمة الكنائس' });
  }
});

// POST /api/super-admin/churches - Add a new Church + Church Admin
superAdminRouter.post('/churches', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      diocese,
      bishop_name,
      address,
      phone,
      email,
      verse,
      logo_url,
      social_links,
      // Admin account fields
      admin_name,
      admin_username,
      admin_password,
      admin_phone,
    } = req.body || {};

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'اسم الكنيسة مطلوب' });
      return;
    }

    if (!admin_username || !admin_password || !admin_name) {
      res.status(400).json({ error: 'بيانات حساب أدمن الكنيسة (الاسم، اسم المستخدم، كلمة المرور) مطلوبة' });
      return;
    }

    const db = getDb();

    // Verify unique Church name
    const trimmedChurchName = name.trim().toLowerCase();
    const existingChurchName = db.churches?.find(
      (c) => c.name.trim().toLowerCase() === trimmedChurchName
    );
    if (existingChurchName) {
      res.status(400).json({
        error: `توجد كنيسة مسجلة بالفعل بهذا الاسم (${name.trim()})، يرجى اختيار اسم مميز أو إضافة المنطقة.`,
      });
      return;
    }

    // Verify unique username
    const cleanAdminUsername = admin_username.trim().toLowerCase();
    const superAdminUser = db.users.find((u) => u.role === 'super_admin');
    if (cleanAdminUsername === 'admin' || (superAdminUser && cleanAdminUsername === superAdminUser.username.toLowerCase())) {
      res.status(400).json({
        error: 'اسم المستخدم محجوز حصرياً لمدير المنظومة العام (Super Admin)، يرجى اختيار اسم مستخدم آخر للكنيسة.',
      });
      return;
    }

    const existingUser = db.users.find(
      (u) => u.username.toLowerCase() === cleanAdminUsername
    );
    if (existingUser) {
      res.status(400).json({
        error: `اسم المستخدم (${admin_username.trim()}) مستخدم بالفعل لكنيسة أخرى أو كحساب مسجل بالنظام، يرجى اختيار اسم مستخدم فريد.`,
      });
      return;
    }

    const churchId = `church_${Date.now()}`;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\w\u0621-\u064A\s-]/g, '')
      .replace(/\s+/g, '-');

    const adminUserId = `user_admin_${Date.now()}`;
    const defaultSalt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(admin_password.trim(), defaultSalt);

    const fullPermissions: PermissionKey[] = [
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
    ];

    const churchAdminUser: User = {
      id: adminUserId,
      username: admin_username.trim(),
      name: admin_name.trim(),
      role: 'church_admin',
      church_id: churchId,
      church_role_title: 'أدمن الكنيسة ومسؤول المنظومة',
      scope: 'all',
      permissions: fullPermissions,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      password_hash: passwordHash,
      plain_password_hint: admin_password.trim(),
    };

    const newChurch: Church = {
      id: churchId,
      name: name.trim(),
      slug: slug || `church-${churchId}`,
      diocese: diocese?.trim() || '',
      bishop_name: bishop_name?.trim() || '',
      address: address?.trim() || '',
      phone: phone?.trim() || admin_phone?.trim() || '',
      email: email?.trim() || '',
      verse: verse?.trim() || 'أَمَّا أَنَا وَبَيْتِي فَنَعْبُدُ الرَّبَّ (يش 24: 15)',
      logo_url: logo_url?.trim() || '',
      social_links: social_links || {},
      status: 'active',
      subscription: {
        plan: 'enterprise',
        status: 'active',
        start_date: new Date().toISOString(),
        features: ['all'],
      },
      primary_admin_id: adminUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await createChurchAtomic(newChurch);
    await createUserAtomic(churchAdminUser);

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'CREATE_CHURCH',
      targetType: 'CHURCH',
      targetId: churchId,
      targetName: newChurch.name,
      description: `قام المدير العام بإنشاء كنيسة جديدة (${newChurch.name}) وربطها بالأدمن (${churchAdminUser.name})`,
    });

    res.status(201).json({
      success: true,
      church: newChurch,
      admin: {
        id: churchAdminUser.id,
        name: churchAdminUser.name,
        username: churchAdminUser.username,
      },
      message: 'تم إنشاء الكنيسة وحساب الأدمن بنجاح',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إنشاء الكنيسة' });
  }
});

// GET /api/super-admin/churches/:id - Single church details
superAdminRouter.get('/churches/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const church = db.churches?.find((c) => c.id === req.params.id);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const churchServants = (db.servants || []).filter((s) => s.church_id === church.id);
    const churchUsers = (db.users || []).filter((u) => u.church_id === church.id);
    const primaryAdmin = churchUsers.find((u) => u.id === church.primary_admin_id || u.role === 'church_admin');

    res.json({
      church,
      servants_count: churchServants.length,
      users_count: churchUsers.length,
      admin: primaryAdmin
        ? {
            id: primaryAdmin.id,
            name: primaryAdmin.name,
            username: primaryAdmin.username,
            status: primaryAdmin.status,
            church_role_title: primaryAdmin.church_role_title,
            password_hint: primaryAdmin.plain_password_hint || null,
          }
        : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب تفاصيل الكنيسة' });
  }
});

// PUT /api/super-admin/churches/:id - Update church info
superAdminRouter.put('/churches/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const church = db.churches?.find((c) => c.id === req.params.id);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const {
      name,
      diocese,
      bishop_name,
      address,
      phone,
      email,
      verse,
      logo_url,
      social_links,
      admin_username,
      admin_password,
      admin_name,
    } = req.body || {};

    if (name) church.name = name.trim();
    if (diocese !== undefined) church.diocese = diocese.trim();
    if (bishop_name !== undefined) church.bishop_name = bishop_name.trim();
    if (address !== undefined) church.address = address.trim();
    if (phone !== undefined) church.phone = phone.trim();
    if (email !== undefined) church.email = email.trim();
    if (verse !== undefined) church.verse = verse.trim();
    if (logo_url !== undefined) church.logo_url = logo_url;
    if (social_links !== undefined) church.social_links = social_links;

    // Update primary church admin credentials (username, password, name)
    const adminUser = db.users.find(
      (u) => u.id === church.primary_admin_id || (u.church_id === church.id && u.role === 'church_admin')
    );

    if (adminUser) {
      const userUpdates: Partial<User> = {};
      if (admin_username && String(admin_username).trim()) {
        const cleanUsername = String(admin_username).trim().toLowerCase();
        if (cleanUsername !== adminUser.username.toLowerCase()) {
          const exists = db.users.some(
            (u) => u.id !== adminUser.id && u.username.toLowerCase() === cleanUsername
          );
          if (exists) {
            res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل من قبل حساب آخر، يرجى اختيار اسم آخر' });
            return;
          }
          userUpdates.username = cleanUsername;
        }
      }

      if (admin_password && String(admin_password).trim()) {
        const cleanPassword = String(admin_password).trim();
        if (cleanPassword.length < 3) {
          res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 3 أحرف' });
          return;
        }
        const salt = bcrypt.genSaltSync(10);
        userUpdates.password_hash = bcrypt.hashSync(cleanPassword, salt);
        userUpdates.plain_password_hint = cleanPassword;
      }

      if (admin_name && String(admin_name).trim()) {
        userUpdates.name = String(admin_name).trim();
      }

      if (Object.keys(userUpdates).length > 0) {
        userUpdates.updated_at = new Date().toISOString();
        await updateUserAtomic(adminUser.id, userUpdates);
      }
    }

    const churchUpdates: Partial<Church> = {};
    if (name) churchUpdates.name = name.trim();
    if (diocese !== undefined) churchUpdates.diocese = diocese.trim();
    if (bishop_name !== undefined) churchUpdates.bishop_name = bishop_name.trim();
    if (address !== undefined) churchUpdates.address = address.trim();
    if (phone !== undefined) churchUpdates.phone = phone.trim();
    if (email !== undefined) churchUpdates.email = email.trim();
    if (verse !== undefined) churchUpdates.verse = verse.trim();
    if (logo_url !== undefined) churchUpdates.logo_url = logo_url;
    if (social_links !== undefined) churchUpdates.social_links = social_links;

    churchUpdates.updated_at = new Date().toISOString();
    await updateChurchAtomic(church.id, churchUpdates);

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'UPDATE_CHURCH',
      targetType: 'CHURCH',
      targetId: church.id,
      targetName: church.name,
      description: `قام المدير العام بتحديث بيانات كنيسة (${church.name}) وبيانات حساب مسؤولها`,
    });

    const updatedChurch = db.churches?.find((c) => c.id === church.id) || church;
    res.json({ success: true, church: updatedChurch, message: 'تم تحديث بيانات الكنيسة وحساب المسؤول بنجاح' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تحديث بيانات الكنيسة' });
  }
});

// PATCH /api/super-admin/churches/:id/status - Change status (active, inactive, suspended, trial)
superAdminRouter.patch('/churches/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const church = db.churches?.find((c) => c.id === req.params.id);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const { status } = req.body as { status: ChurchStatus };
    const validStatuses: ChurchStatus[] = ['active', 'inactive', 'suspended', 'trial'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'حالة غير صالحة' });
      return;
    }

    await updateChurchAtomic(church.id, {
      status,
      updated_at: new Date().toISOString(),
    });

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'CHANGE_CHURCH_STATUS',
      targetType: 'CHURCH',
      targetId: church.id,
      targetName: church.name,
      description: `قام المدير العام بتغيير حالة الكنيسة (${church.name}) إلى (${status})`,
    });

    res.json({
      success: true,
      church,
      message: `تم تغيير حالة الكنيسة إلى ${status === 'active' ? 'نشطة' : status === 'suspended' ? 'موقوفة' : status}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تغيير حالة الكنيسة' });
  }
});

// POST /api/super-admin/churches/:id/reset-admin-password - Reset church admin password and username
superAdminRouter.post('/churches/:id/reset-admin-password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const church = db.churches?.find((c) => c.id === req.params.id);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const { new_password, new_username } = req.body || {};

    const adminUser = db.users.find((u) => u.id === church.primary_admin_id || (u.church_id === church.id && u.role === 'church_admin'));
    if (!adminUser) {
      res.status(404).json({ error: 'لم يتم العثور على حساب أدمن لهذه الكنيسة' });
      return;
    }

    let updatedUsername = false;
    let updatedPassword = false;
    let cleanNewPassword = '';

    if (new_username && String(new_username).trim()) {
      const cleanUsername = String(new_username).trim().toLowerCase();
      if (cleanUsername !== adminUser.username.toLowerCase()) {
        const exists = db.users.some(
          (u) => u.id !== adminUser.id && u.username.toLowerCase() === cleanUsername
        );
        if (exists) {
          res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل من قبل حساب آخر، يرجى اختيار اسم آخر' });
          return;
        }
        adminUser.username = cleanUsername;
        updatedUsername = true;
      }
    }

    if (new_password && String(new_password).trim()) {
      if (String(new_password).trim().length < 3) {
        res.status(400).json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 3 أحرف' });
        return;
      }
      const salt = bcrypt.genSaltSync(10);
      cleanNewPassword = String(new_password).trim();
      adminUser.password_hash = bcrypt.hashSync(cleanNewPassword, salt);
      adminUser.plain_password_hint = cleanNewPassword;
      updatedPassword = true;
    }

    if (!updatedUsername && !updatedPassword) {
      res.status(400).json({ error: 'يرجى إدخال اسم مستخدم جديد أو كلمة مرور جديدة للتحديث' });
      return;
    }

    const nowIso = new Date().toISOString();
    adminUser.updated_at = nowIso;
    if (updatedPassword) {
      await updateUserPasswordAtomic(adminUser.id, adminUser.password_hash, cleanNewPassword);
    }
    if (updatedUsername) {
      await updateUserAtomic(adminUser.id, { username: adminUser.username, updated_at: nowIso });
    }

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'RESET_CHURCH_ADMIN_CREDENTIALS',
      targetType: 'USER',
      targetId: adminUser.id,
      targetName: adminUser.name,
      description: `قام المدير العام بتحديث بيانات دخول أدمن كنيسة (${church.name})`,
    });

    res.json({
      success: true,
      message: 'تم تحديث بيانات دخول مسؤول الكنيسة بنجاح',
      username: adminUser.username,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تحديث بيانات الدخول' });
  }
});

// PATCH /api/super-admin/churches/:id/subscription - Update subscription & payment status
superAdminRouter.patch('/churches/:id/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const church = db.churches?.find((c) => c.id === req.params.id);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const { plan, payment_status, status, end_date, next_due_date, fee, notes } = req.body || {};

    const updatedSub = {
      ...(church.subscription || {
        plan: 'basic',
        status: 'active',
        start_date: new Date().toISOString(),
      }),
    };

    if (plan !== undefined) updatedSub.plan = plan;
    if (payment_status !== undefined) updatedSub.payment_status = payment_status;
    if (status !== undefined) updatedSub.status = status;
    if (end_date !== undefined) updatedSub.end_date = end_date;
    if (next_due_date !== undefined) updatedSub.next_due_date = next_due_date;
    if (fee !== undefined) updatedSub.fee = Number(fee);
    if (notes !== undefined) updatedSub.notes = notes;

    let targetStatus = church.status;
    if (payment_status === 'paid') {
      updatedSub.last_payment_date = new Date().toISOString();
      if (church.status === 'suspended') {
        targetStatus = 'active';
      }
    } else if (payment_status === 'overdue' && status === 'expired') {
      targetStatus = 'suspended';
    }

    const nowIso = new Date().toISOString();
    await updateChurchAtomic(church.id, {
      subscription: updatedSub,
      status: targetStatus,
      updated_at: nowIso,
    });

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'UPDATE_CHURCH_SUBSCRIPTION',
      targetType: 'CHURCH',
      targetId: church.id,
      targetName: church.name,
      description: `قام المدير العام بتحديث اشتراك كنيسة (${church.name}) إلى (${church.subscription.plan} / ${church.subscription.payment_status || 'نشط'})`,
    });

    res.json({
      success: true,
      church,
      message: 'تم تحديث بيانات الاشتراك وحالة الدفع بنجاح',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تحديث بيانات الاشتراك' });
  }
});

// POST /api/super-admin/churches/:id/send-renewal-alert - Send renewal reminder notification to church
superAdminRouter.post('/churches/:id/send-renewal-alert', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const church = db.churches?.find((c) => c.id === req.params.id);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const { custom_message } = req.body || {};

    const updatedSub = {
      ...(church.subscription || {
        plan: 'basic',
        status: 'active',
        start_date: new Date().toISOString(),
      }),
    };

    const dueDate = updatedSub.next_due_date || 'قريباً';
    const feeText = updatedSub.fee ? `${updatedSub.fee} ج.م` : '';
    const defaultMsg = `تذكير من الإدارة المركزية: موعد تجديد اشتراك الكنيسة السنوي يستحق في (${dueDate}) ${feeText ? `بقيمة ${feeText}` : ''}. يرجى التنسيق لسداد الرسوم عبر قنوات التواصل المعتمدة أو الاتصال على رقم 01012348828 (م/ أبانوب وجيه) لضمان استمرار كافة الخدمات والأنظمة.`;

    updatedSub.renewal_notice = {
      sent_at: new Date().toISOString(),
      sent_by_name: req.user!.name,
      message: custom_message?.trim() || defaultMsg,
      acknowledged: false,
    };

    const nowIso = new Date().toISOString();
    await updateChurchAtomic(church.id, {
      subscription: updatedSub,
      updated_at: nowIso,
    });

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'SEND_RENEWAL_ALERT',
      targetType: 'CHURCH',
      targetId: church.id,
      targetName: church.name,
      description: `قام المدير العام بإرسال إشعار تذكير بتجديد الاشتراك لكنيسة (${church.name})`,
    });

    res.json({
      success: true,
      message: `تم إرسال إشعار تجديد الاشتراك إلى كنيسة (${church.name}) بنجاح`,
      renewal_notice: church.subscription.renewal_notice,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إرسال إشعار التجديد' });
  }
});

// PATCH /api/super-admin/my-account - Allow Super Admin to update their name, username, and password
superAdminRouter.patch('/my-account', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.user!.id && u.role === 'super_admin');
    if (!user) {
      res.status(404).json({ error: 'حساب المدير العام غير موجود' });
      return;
    }

    const { name, username, email, current_password, new_password } = req.body || {};

    // If updating email
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (cleanEmail && !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
        return;
      }
      user.email = cleanEmail || undefined;
    }

    // If updating username
    if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const cleanNewUsername = username.trim().toLowerCase();
      const conflict = db.users.find(
        (u) => u.username.toLowerCase() === cleanNewUsername && u.id !== user.id
      );
      if (conflict) {
        res.status(400).json({ error: 'اسم المستخدم الجديد مستخدم بالفعل، يرجى اختيار اسم آخر' });
        return;
      }
      user.username = username.trim();
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    // If updating password
    if (new_password) {
      if (!current_password) {
        res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية للتأكيد' });
        return;
      }
      const isMatch = bcrypt.compareSync(current_password, user.password_hash || '');
      if (!isMatch) {
        res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        return;
      }
      if (String(new_password).trim().length < 3) {
        res.status(400).json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 3 أحرف' });
        return;
      }
      const salt = bcrypt.genSaltSync(10);
      user.password_hash = bcrypt.hashSync(String(new_password).trim(), salt);
    }

    user.updated_at = new Date().toISOString();
    await updateUserAtomic(user.id, {
      name: user.name,
      username: user.username,
      email: user.email,
      password_hash: user.password_hash,
      updated_at: user.updated_at,
    });

    logAudit({
      userId: user.id,
      username: user.username,
      action: 'UPDATE_SUPER_ADMIN_ACCOUNT',
      targetType: 'USER',
      targetId: user.id,
      targetName: user.name,
      description: `قام المدير العام بتحديث بيانات حسابه الإداري (اسم المستخدم: ${user.username})`,
    });

    const safeUser = sanitizeUser(user);
    res.json({
      success: true,
      user: safeUser,
      message: 'تم تحديث بيانات حسابك الإداري بنجاح',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تحديث بيانات الحساب' });
  }
});

// DELETE /api/super-admin/churches/:id - Complete cascading deletion of a church and all its related records
superAdminRouter.delete('/churches/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const churchId = req.params.id;
    const churchIndex = (db.churches || []).findIndex((c) => c.id === churchId);

    if (churchIndex === -1) {
      res.status(404).json({ error: 'الكنيسة غير موجودة أو تم حذفها بالفعل' });
      return;
    }

    const churchName = db.churches[churchIndex].name;

    // 1. Remove church record via atomic delete from Firestore
    await deleteChurchAtomic(churchId);

    // 2. Cascade delete all users associated with this church
    const churchUsers = (db.users || []).filter((u) => u.church_id === churchId);
    for (const u of churchUsers) {
      await deleteUserAtomic(u.id).catch(() => {});
    }

    // 3. Cascade delete all servants
    const churchServants = (db.servants || []).filter((s) => s.church_id === churchId);
    for (const s of churchServants) {
      await deleteServantAtomic(s.id).catch(() => {});
    }

    // 4. Cascade delete all services
    const churchServices = (db.services || []).filter((s) => s.church_id === churchId);
    for (const srvc of churchServices) {
      await deleteServiceAtomic(srvc.id).catch(() => {});
    }

    // 5. In-memory dependent array cleanup
    db.assignments = (db.assignments || []).filter((a) => a.church_id !== churchId);
    db.attendance = (db.attendance || []).filter((att) => att.church_id !== churchId);
    db.general_meetings = (db.general_meetings || []).filter((m) => m.church_id !== churchId);
    db.general_meeting_records = (db.general_meeting_records || []).filter((r) => r.church_id !== churchId);
    db.scanner_devices = (db.scanner_devices || []).filter((d) => d.church_id !== churchId);
    db.registration_codes = (db.registration_codes || []).filter((c) => c.church_id !== churchId);
    db.audit_logs = (db.audit_logs || []).filter((l) => l.church_id !== churchId);

    saveLocalDatabaseOnly();

    logAudit({
      userId: req.user!.id,
      username: req.user!.name,
      action: 'DELETE_CHURCH',
      targetType: 'CHURCH',
      targetId: churchId,
      targetName: churchName,
      description: `قام المدير العام بحذف كنيسة (${churchName}) نهائياً وكافة بيانات الخدام والخدمات والمستخدمين التابعين لها`,
    });

    res.json({
      success: true,
      message: `تم حذف كنيسة (${churchName}) وكافة بياناتها نهائياً بنجاح`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل حذف الكنيسة' });
  }
});

// GET /api/super-admin/face-id/info - Get current face ID enrollment status
superAdminRouter.get('/face-id/info', (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const superAdmin = db.users.find((u) => u.id === req.user!.id);
    if (!superAdmin) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    res.json({
      is_enrolled: Boolean(superAdmin.face_biometric_data),
      enrolled_at: superAdmin.face_enrolled_at || null,
      admin_name: superAdmin.name,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب بيانات بصمة الوجه' });
  }
});

// POST /api/super-admin/face-id/enroll - Enroll or update Face ID biometric data
superAdminRouter.post('/face-id/enroll', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { biometric_vector } = req.body;
    if (!Array.isArray(biometric_vector) || biometric_vector.length < 16) {
      res.status(400).json({ error: 'يرجى تقديم بيانات مسح بصمة وجه مكتملة وصحيحة' });
      return;
    }

    const db = getDb();
    const superAdmin = db.users.find((u) => u.id === req.user!.id);
    if (!superAdmin) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    const enrolledAt = new Date().toISOString();
    await updateUserFaceAtomic(superAdmin.id, JSON.stringify(biometric_vector), enrolledAt);

    logAudit({
      userId: superAdmin.id,
      username: superAdmin.username,
      action: 'ENROLL_FACE_ID',
      targetType: 'USER',
      targetId: superAdmin.id,
      targetName: superAdmin.name,
      description: `قام المدير العام (${superAdmin.name}) بتسجيل وتفعيل بصمة الوجه (Face ID) لحسابه`,
    });

    res.json({
      success: true,
      message: 'تم تسجيل وتفعيل بصمة الوجه بنجاح! يمكنك الآن تسجيل الدخول بها من صفحة تسجيل الدخول.',
      enrolled_at: enrolledAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل حفظ بصمة الوجه' });
  }
});

// DELETE /api/super-admin/face-id - Remove Face ID biometric data
superAdminRouter.delete('/face-id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const superAdmin = db.users.find((u) => u.id === req.user!.id);
    if (!superAdmin) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    await updateUserFaceAtomic(superAdmin.id, undefined, undefined);

    logAudit({
      userId: superAdmin.id,
      username: superAdmin.username,
      action: 'REMOVE_FACE_ID',
      targetType: 'USER',
      targetId: superAdmin.id,
      targetName: superAdmin.name,
      description: `قام المدير العام (${superAdmin.name}) بحذف بصمة الوجه الخاصة بحسابه`,
    });

    res.json({
      success: true,
      message: 'تم إلغاء وحذف بصمة الوجه بنجاح. يمكنك الآن الدخول بكلمة المرور فقط.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إزالة بصمة الوجه' });
  }
});

// GET /api/super-admin/cloud-sync-status - Check Cloud Firestore persistent sync status
superAdminRouter.get('/cloud-sync-status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const info = getCloudSyncInfo();
    res.json({
      success: true,
      ...info,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب حالة المزامنة السحابية' });
  }
});

// POST /api/super-admin/cloud-sync-now - Force instant two-way sync with Cloud Firestore
superAdminRouter.post('/cloud-sync-now', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pushToFirestoreImmediate();
    await syncFromFirestore();
    const info = getCloudSyncInfo();

    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'MANUAL_CLOUD_SYNC',
      targetType: 'SYSTEM',
      description: 'قام المدير العام بإجراء مزامنة سحابية فورية مع Cloud Firestore',
    });

    res.json({
      success: true,
      message: 'تمت المزامنة وحفظ جميع البيانات في Cloud Firestore بنجاح ☁️',
      ...info,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشلت المزامنة السحابية' });
  }
});

// GET /api/super-admin/smtp-settings - Get current email settings
superAdminRouter.get('/smtp-settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const smtp = (db as any).smtp_settings || {};
    res.json({
      success: true,
      host: smtp.host || 'smtp.gmail.com',
      port: smtp.port || '465',
      secure: smtp.secure !== false,
      user: smtp.user || '',
      from: smtp.from || '',
      pass_configured: Boolean(smtp.pass),
      is_configured: Boolean(smtp.user && smtp.pass),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب إعدادات البريد' });
  }
});

// POST /api/super-admin/smtp-settings - Save email settings
superAdminRouter.post('/smtp-settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host, port, secure, user, pass, from } = req.body || {};
    const db = getDb() as any;

    if (!db.smtp_settings) {
      db.smtp_settings = {};
    }

    if (host !== undefined) db.smtp_settings.host = String(host).trim();
    if (port !== undefined) db.smtp_settings.port = parseInt(port, 10) || 465;
    if (secure !== undefined) db.smtp_settings.secure = Boolean(secure);
    if (user !== undefined) db.smtp_settings.user = String(user).trim();
    if (from !== undefined) db.smtp_settings.from = String(from).trim();
    if (pass && String(pass).trim()) {
      db.smtp_settings.pass = String(pass).trim();
    }

    saveDatabase();

    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'UPDATE_SMTP_SETTINGS',
      targetType: 'SYSTEM',
      description: 'قام المدير العام بتحديث إعدادات خادم البريد الإلكتروني (SMTP)',
    });

    res.json({
      success: true,
      message: 'تم حفظ إعدادات خادم البريد (SMTP) بنجاح!',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل حفظ إعدادات البريد' });
  }
});


