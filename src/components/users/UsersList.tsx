import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { User, RoleType, PermissionKey, ChurchService } from '../../types/index.js';
import { BulkUsersModal } from './BulkUsersModal.js';
import { getUserChurchRoleTitle, getCleanUserName } from '../../utils/userDisplay.js';
import {
  ShieldCheck,
  Plus,
  KeyRound,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Lock,
  AlertCircle,
  X,
  Check,
  Cross,
  Users,
} from 'lucide-react';

const ALL_PERMISSIONS: { key: PermissionKey; label_ar: string; label_en: string }[] = [
  { key: 'view_servants', label_ar: 'عرض سجل الخدام', label_en: 'View Servants' },
  { key: 'add_servant', label_ar: 'إضافة خادم جديد', label_en: 'Add Servant' },
  { key: 'edit_servant', label_ar: 'تعديل بيانات الخادم', label_en: 'Edit Servant' },
  { key: 'delete_servant', label_ar: 'حذف خادم', label_en: 'Delete Servant' },
  { key: 'view_servant_details', label_ar: 'الاطلاع على البيانات السرية وصور البطاقات', label_en: 'View Confidential Details & ID Cards' },
  { key: 'view_services', label_ar: 'عرض الخدمات', label_en: 'View Services' },
  { key: 'add_service', label_ar: 'إضافة خدمات جديدة', label_en: 'Add Services' },
  { key: 'edit_service', label_ar: 'تعديل الخدمات', label_en: 'Edit Services' },
  { key: 'delete_service', label_ar: 'حذف خدمات', label_en: 'Delete Services' },
  { key: 'view_attendance', label_ar: 'عرض سجلات الحضور', label_en: 'View Attendance' },
  { key: 'add_attendance', label_ar: 'تسجيل الحضور والغياب', label_en: 'Record Attendance' },
  { key: 'edit_attendance', label_ar: 'تعديل سجلات حضور سابقة', label_en: 'Edit Past Attendance' },
  { key: 'delete_attendance', label_ar: 'حذف سجلات حضور', label_en: 'Delete Attendance' },
  { key: 'view_reports', label_ar: 'عرض التقارير والإحصائيات', label_en: 'View Reports' },
  { key: 'export_reports', label_ar: 'تصدير الكشوف والملفات', label_en: 'Export Reports' },
  { key: 'view_users', label_ar: 'إدارة المستخدمين', label_en: 'Manage Users' },
  { key: 'add_user', label_ar: 'إنشاء حسابات مستخدمين', label_en: 'Create Users' },
  { key: 'edit_user', label_ar: 'تعديل المستخدمين والصلاحيات', label_en: 'Edit Users' },
  { key: 'view_history', label_ar: 'عرض سجل الرقابة والتدقيق (Audit Log)', label_en: 'View Audit Log' },
  { key: 'manage_permissions', label_ar: 'إدارة الصلاحيات المتقدمة', label_en: 'Manage Advanced Permissions' },
];

export const UsersList: React.FC = () => {
  const { user: currentUser, hasPermission, updateUser, refreshUser } = useAuth();
  const { t, language } = useLanguage();

  const [users, setUsers] = useState<any[]>([]);
  const [services, setServices] = useState<ChurchService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
  const [isChangeMyPasswordOpen, setIsChangeMyPasswordOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; users: any[] }>('/api/users');
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await api.get<{ success: boolean; services: ChurchService[] }>('/api/services');
      setServices(res.services);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchServices();
  }, []);

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await api.delete(`/api/users/${deletingUser.id}`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف المستخدم');
    }
  };

  const getRoleLabel = (u: any) => {
    if (u.church_role_title && String(u.church_role_title).trim()) {
      return u.church_role_title;
    }
    return getUserChurchRoleTitle(u, services);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            {t('nav_users')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {language === 'ar'
              ? 'إدارة حسابات الآباء الكهنة، أمناء الخدمة، وتخصيص نطاق الصلاحيات'
              : 'Manage Priest & Leader accounts, scopes, and customized permissions'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Change My Password button */}
          <button
            onClick={() => setIsChangeMyPasswordOpen(true)}
            className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>{language === 'ar' ? 'تغيير كلمة مروري' : 'Change My Password'}</span>
          </button>

          {hasPermission('add_user') && (
            <button
              onClick={() => setIsBulkOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>{language === 'ar' ? 'توليد حسابات للخدام دفعة واحدة' : 'Bulk Servant Accounts'}</span>
            </button>
          )}

          {hasPermission('add_user') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'إنشاء حساب جديد (أب كاهن / أمين)' : 'Create User'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-stone-500">{t('common_loading')}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800">
                <tr>
                  <th className="py-3 px-4 text-start">اسم المستخدم والاسم الكامل</th>
                  <th className="py-3 px-4 text-start">الدور الإداري</th>
                  <th className="py-3 px-4 text-start">نطاق الخدمة (Scope)</th>
                  <th className="py-3 px-4 text-center">عدد الصلاحيات</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors">
                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900 dark:text-white text-xs">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                        @{u.username}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-stone-800 dark:text-stone-200">
                        {u.role === 'super_admin' && <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />}
                        {getRoleLabel(u)}
                      </span>
                    </td>

                    {/* Scope */}
                    <td className="py-3 px-4">
                      <span className="text-stone-600 dark:text-stone-400 font-medium">
                        {u.scope_service_name}
                      </span>
                    </td>

                    {/* Permissions count */}
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[11px]">
                        {u.permissions.length} {language === 'ar' ? 'صلاحية' : 'perms'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {u.status === 'active' ? 'نشط' : 'معطل'}
                      </span>
                      {u.must_change_password && (
                        <span className="block mt-1 text-[9px] font-semibold text-amber-700 dark:text-amber-400">
                          (يلزم تغيير كلمة المرور)
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        {/* Reset Password */}
                        {hasPermission('edit_user') && (
                          <button
                            onClick={() => setResetPasswordUser(u)}
                            title="إعادة تعيين كلمة المرور"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit User & Permissions */}
                        {hasPermission('edit_user') && (
                          <button
                            onClick={() => setEditingUser(u)}
                            title="تعديل الصلاحيات والحساب"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete User */}
                        {hasPermission('delete_user') && u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeletingUser(u)}
                            title="حذف الحساب"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit User Modal */}
      {(isAddOpen || editingUser) && (
        <UserFormModal
          user={editingUser}
          services={services}
          onClose={() => {
            setIsAddOpen(false);
            setEditingUser(null);
          }}
          onSuccess={async (updatedObj?: any) => {
            setIsAddOpen(false);
            setEditingUser(null);
            if (updatedObj && currentUser && (updatedObj.id === currentUser.id || updatedObj.username === currentUser.username)) {
              updateUser(updatedObj);
            }
            fetchUsers();
            await refreshUser();
          }}
        />
      )}

      {/* Bulk Users Modal */}
      {isBulkOpen && (
        <BulkUsersModal
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          onSuccess={() => {
            fetchUsers();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => setResetPasswordUser(null)}
        />
      )}

      {/* Change My Password Modal */}
      {isChangeMyPasswordOpen && (
        <ChangeMyPasswordModal onClose={() => setIsChangeMyPasswordOpen(false)} />
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
              تأكيد حذف المستخدم
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
              هل أنت متأكد من حذف حساب ({deletingUser.name} - @{deletingUser.username}) نهائياً؟
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                {t('common_cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {t('common_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Modal: User Form (Add / Edit) with RBAC and Permissions Selector
interface UserFormModalProps {
  user?: any;
  services: ChurchService[];
  onClose: () => void;
  onSuccess: (updatedUser?: any) => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, services, onClose, onSuccess }) => {
  const { user: currentUser, updateUser, refreshUser } = useAuth();
  const isEdit = Boolean(user);

  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [churchRoleTitle, setChurchRoleTitle] = useState(user?.church_role_title || '');
  const [role, setRole] = useState<RoleType>(user?.role || 'captain');
  const [scope, setScope] = useState(user?.scope || 'all');
  const [status, setStatus] = useState<'active' | 'disabled'>(user?.status || 'active');
  const [permissions, setPermissions] = useState<PermissionKey[]>(user?.permissions || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When role changes, update default permissions and suggest role title
  const handleRoleChange = (newRole: RoleType) => {
    setRole(newRole);

    // If church role title is empty or a common default, sync it with the selected role
    if (
      !churchRoleTitle ||
      churchRoleTitle === 'المدير العام' ||
      churchRoleTitle === 'أمين الخدمة العام' ||
      churchRoleTitle === 'أمين خدمة' ||
      churchRoleTitle === 'خادم' ||
      churchRoleTitle === 'أب كاهن' ||
      churchRoleTitle === 'مسؤول إداري'
    ) {
      if (newRole === 'servant') setChurchRoleTitle('خادم');
      else if (newRole === 'super_admin') setChurchRoleTitle('أمين الخدمة العام');
      else if (newRole === 'priest') setChurchRoleTitle('أب كاهن');
      else if (newRole === 'general_secretary') setChurchRoleTitle('أمين عام الخدمة');
      else if (newRole === 'stage_coordinator') setChurchRoleTitle('منسق مرحلة كنسية');
      else if (newRole === 'captain') setChurchRoleTitle('أمين خدمة');
      else if (newRole === 'manager') setChurchRoleTitle('مسؤول إداري');
    }

    if (!isEdit) {
      if (newRole === 'super_admin') {
        setPermissions(ALL_PERMISSIONS.map((p) => p.key));
        setScope('all');
      } else if (newRole === 'priest') {
        setPermissions([
          'view_servants',
          'add_servant',
          'edit_servant',
          'view_servant_details',
          'view_services',
          'add_service',
          'edit_service',
          'view_attendance',
          'add_attendance',
          'edit_attendance',
          'view_reports',
          'export_reports',
          'view_history',
        ]);
        setScope('all');
      } else if (newRole === 'general_secretary') {
        setPermissions([
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
        ]);
        setScope('all');
      } else if (newRole === 'stage_coordinator') {
        setPermissions([
          'view_servants',
          'edit_servant',
          'view_servant_details',
          'view_services',
          'view_attendance',
          'add_attendance',
          'edit_attendance',
          'view_reports',
        ]);
      } else if (newRole === 'servant') {
        setPermissions(['view_servants', 'view_services', 'view_attendance', 'view_reports']);
      } else if (newRole === 'captain') {
        setPermissions([
          'view_servants',
          'edit_servant',
          'view_servant_details',
          'view_services',
          'view_attendance',
          'add_attendance',
          'edit_attendance',
          'view_reports',
        ]);
        if (services.length > 0) setScope(services[0].id);
      } else if (newRole === 'manager') {
        setPermissions([
          'view_servants',
          'add_servant',
          'edit_servant',
          'view_services',
          'view_attendance',
          'add_attendance',
          'view_reports',
          'export_reports',
        ]);
      } else {
        setPermissions(['view_servants', 'view_services', 'view_attendance', 'view_reports']);
      }
    }
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!isEdit && (!username || !password))) {
      setError('يرجى ملء جميع الحقول الإلزامية');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: any = {
      name: name.trim(),
      church_role_title: churchRoleTitle.trim(),
      role,
      scope,
      status,
      permissions,
    };

    if (!isEdit) {
      payload.username = username.trim().toLowerCase();
      payload.password = password;
    }

    try {
      let resData: any = null;
      if (isEdit) {
        resData = await api.put<{ success: boolean; user: any }>(`/api/users/${user.id}`, payload);
      } else {
        resData = await api.post<{ success: boolean; user: any }>('/api/users', payload);
      }

      const updatedObj = resData?.user || { ...user, ...payload };
      if (currentUser && user && (user.id === currentUser.id || user.username === currentUser.username)) {
        updateUser(updatedObj);
        await refreshUser();
      }

      onSuccess(updatedObj);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ المستخدم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-2xl my-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-white font-serif">
            {isEdit ? 'تعديل حساب المستخدم والصلاحيات' : 'إنشاء حساب إداري جديد'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                الاسم الكامل *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: القس جرجس / أ. مينا عادل"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                الرتبة أو الصفة الكنسية المخصصة (تظهر بين قوسين في التحية)
              </label>
              <input
                type="text"
                value={churchRoleTitle}
                onChange={(e) => setChurchRoleTitle(e.target.value)}
                placeholder="مثال: أب كاهن / أمين خدمة ثانوي / أمين الخدمة العام"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>

            {!isEdit && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mina_adel"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                />
              </div>
            )}

            {!isEdit && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  كلمة المرور الأولية *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                الدور الأساسي (Role) *
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as RoleType)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              >
                <option value="super_admin">المدير العام / أمين الخدمة العام (Super Admin)</option>
                <option value="servant">خادم (Servant)</option>
                <option value="captain">أمين خدمة / أسرة (Captain)</option>
                <option value="priest">أب كاهن (Priest)</option>
                <option value="general_secretary">أمين عام الخدمة (General Secretary)</option>
                <option value="stage_coordinator">منسق مرحلة كنسية (Stage Coordinator)</option>
                <option value="manager">مسؤول إداري (Manager)</option>
                <option value="viewer">مستعرض فقط (Viewer)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                نطاق البيانات (Scope) *
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              >
                <option value="all">كافة الخدمات (شامل)</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    محدد بخدمة: {s.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {isEdit && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  حالة الحساب
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                >
                  <option value="active">نشط ومفعل</option>
                  <option value="disabled">معطل وموقوف</option>
                </select>
              </div>
            )}
          </div>

          {/* Granular Permissions Matrix */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-stone-900 dark:text-white mb-2">
              جدول الصلاحيات المخصصة للمستخدم (Custom Permissions)
            </label>
            <div className="max-h-48 overflow-y-auto p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((perm) => {
                const isChecked = permissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-stone-800 cursor-pointer text-xs select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePermission(perm.key)}
                      className="rounded-sm text-amber-700 focus:ring-amber-600 w-3.5 h-3.5"
                    />
                    <span className="text-stone-800 dark:text-stone-200 font-medium">
                      {perm.label_ar}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ الحساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Reset User Password
interface ResetPasswordModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.patch(`/api/users/${user.id}/reset-password`, {
        new_password: newPassword,
      });
      alert('تم إعادة تعيين كلمة المرور بنجاح');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إعادة تعيين كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
        <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
          إعادة تعيين كلمة المرور
        </h3>
        <p className="text-xs text-stone-600 dark:text-stone-400 mb-4">
          تعيين كلمة مرور جديدة للمستخدم: <strong>{user.name}</strong> (@{user.username})
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-xs text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
            >
              {loading ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Change My Password
const ChangeMyPasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      alert('تم تغيير كلمة المرور بنجاح');
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تغيير كلمة المرور، تحقق من كلمة المرور الحالية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
        <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
          تغيير كلمة المرور الخاصة بك
        </h3>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-xs text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              كلمة المرور الحالية
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
            >
              {loading ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
