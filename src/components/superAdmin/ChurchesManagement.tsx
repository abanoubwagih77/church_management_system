import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Church } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { LogoUploader } from '../common/LogoUploader.js';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Shield,
  Phone,
  MapPin,
  Users,
  X,
  KeyRound,
  Edit,
  ExternalLink,
  BookOpen,
  Share2,
  Sparkles,
  Lock,
  User,
  Cross,
  CreditCard,
  Calendar,
  DollarSign,
  Filter,
  Trash2,
  Bell,
  Send,
  ScanFace,
  Camera,
  Eye,
  EyeOff,
  Copy,
  Mail,
} from 'lucide-react';
import { FaceScannerModal } from '../common/FaceScannerModal.js';

interface ChurchWithStats extends Church {
  servants_count?: number;
  services_count?: number;
  users_count?: number;
  admin_info?: {
    id: string;
    name: string;
    username: string;
    status: string;
    password_hint?: string | null;
  } | null;
}

interface ChurchesManagementProps {}

export const ChurchesManagement: React.FC<ChurchesManagementProps> = () => {
  const { user, updateUser } = useAuth();
  const [churches, setChurches] = useState<ChurchWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'trial' | 'suspended'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [churchToDelete, setChurchToDelete] = useState<ChurchWithStats | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<ChurchWithStats | null>(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingAlertChurchId, setSendingAlertChurchId] = useState<string | null>(null);
  const [isAlertsDismissed, setIsAlertsDismissed] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    host: 'smtp.gmail.com',
    port: '465',
    secure: true,
    user: '',
    pass: '',
    from: '',
  });
  const [smtpLoading, setSmtpLoading] = useState(false);

  const togglePasswordVisibility = (key: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyTextToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Status Toggle Modal State
  const [statusModal, setStatusModal] = useState<{ church: Church; nextStatus: 'active' | 'suspended' } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Face ID State for Super Admin
  const [isFaceEnrolled, setIsFaceEnrolled] = useState(false);
  const [faceEnrolledAt, setFaceEnrolledAt] = useState<string | null>(null);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const [faceActionLoading, setFaceActionLoading] = useState(false);

  // Super Admin Account Settings State
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    username: '',
    email: '',
    current_password: '',
    new_password: '',
  });
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  const openAccountModal = () => {
    setAccountFormData({
      name: user?.name || '',
      username: user?.username || '',
      email: (user as any)?.email || 'abanoub.wagih77@gmail.com',
      current_password: '',
      new_password: '',
    });
    setAccountError(null);
    setAccountSuccess(null);
    setIsAccountModalOpen(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountSuccess(null);
    setAccountLoading(true);
    try {
      const res = await api.patch<{ success: boolean; user: any; message: string }>('/api/super-admin/my-account', accountFormData);
      setAccountSuccess(res.message || 'تم تحديث بيانات حسابك بنجاح');
      if (res.user && updateUser) {
        updateUser(res.user);
      }
      setTimeout(() => {
        setIsAccountModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setAccountError(err.message || 'فشل تحديث بيانات الحساب');
    } finally {
      setAccountLoading(false);
    }
  };

  // Subscription Form state
  const [subFormData, setSubFormData] = useState({
    plan: 'basic',
    payment_status: 'paid' as 'paid' | 'unpaid' | 'overdue' | 'trial',
    fee: 500,
    last_payment_date: '',
    next_due_date: '',
    notes: '',
  });

  // Add Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    diocese: '',
    bishop_name: '',
    address: '',
    phone: '',
    email: '',
    verse: '«أَمَّا أَنَا وَبَيْتِي فَنَعْبُدُ الرَّبَّ» (يشوع ٢٤ : ١٥)',
    logo_url: '',
    facebook_url: '',
    youtube_url: '',
    instagram_url: '',
    admin_username: '',
    admin_password: '',
    admin_name: '',
  });

  // Edit Form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    diocese: '',
    bishop_name: '',
    address: '',
    phone: '',
    email: '',
    verse: '',
    logo_url: '',
    facebook_url: '',
    youtube_url: '',
    instagram_url: '',
    admin_username: '',
    admin_password: '',
    admin_name: '',
  });

  const fetchChurches = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; churches: ChurchWithStats[] }>('/api/super-admin/churches');
      if (res.churches) {
        setChurches(res.churches);
      }
    } catch (err: any) {
      console.error('Failed to fetch churches', err);
      setMessage({ type: 'error', text: err.message || 'فشل في تحميل قائمة الكنائس' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFaceIdStatus = async () => {
    try {
      const res = await api.get<{ is_enrolled: boolean; enrolled_at: string | null; admin_name?: string }>(
        '/api/super-admin/face-id/info'
      );
      if (res) {
        setIsFaceEnrolled(Boolean(res.is_enrolled));
        setFaceEnrolledAt(res.enrolled_at || null);
      }
    } catch {
      // ignore
    }
  };

  const handleEnrollFaceComplete = async (vector: number[]) => {
    setFaceActionLoading(true);
    try {
      const res = await api.post<{ success: boolean; message: string; enrolled_at: string }>(
        '/api/super-admin/face-id/enroll',
        { biometric_vector: vector }
      );
      setIsFaceEnrolled(true);
      setFaceEnrolledAt(res.enrolled_at || new Date().toISOString());
      setMessage({ type: 'success', text: res.message || 'تم تسجيل وتفعيل بصمة الوجه بنجاح' });
      setIsFaceScannerOpen(false);
    } catch (err: any) {
      throw new Error(err.message || 'فشل حفظ بصمة الوجه');
    } finally {
      setFaceActionLoading(false);
    }
  };

  const handleRemoveFaceId = async () => {
    setFaceActionLoading(true);
    try {
      await api.delete('/api/super-admin/face-id');
      setIsFaceEnrolled(false);
      setFaceEnrolledAt(null);
      setMessage({ type: 'success', text: 'تم إلغاء وحذف بصمة الوجه بنجاح' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل إزالة بصمة الوجه' });
    } finally {
      setFaceActionLoading(false);
    }
  };

  const fetchSmtpSettings = async () => {
    try {
      const res = await api.get<{
        host?: string;
        port?: string | number;
        secure?: boolean;
        user?: string;
        from?: string;
        pass_configured?: boolean;
      }>('/api/super-admin/smtp-settings');
      if (res) {
        setSmtpForm({
          host: res.host || 'smtp.gmail.com',
          port: String(res.port || '465'),
          secure: res.secure !== false,
          user: res.user || '',
          pass: '',
          from: res.from || '',
        });
      }
    } catch {
      // ignore
    }
  };

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpLoading(true);
    try {
      await api.post('/api/super-admin/smtp-settings', smtpForm);
      setMessage({ type: 'success', text: 'تم حفظ إعدادات خادم البريد (SMTP) بنجاح!' });
      setIsSmtpModalOpen(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل حفظ إعدادات البريد' });
    } finally {
      setSmtpLoading(false);
    }
  };

  useEffect(() => {
    fetchChurches();
    fetchFaceIdStatus();
  }, []);

  const handleCreateChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.admin_username || !formData.admin_password || !formData.admin_name) {
      setMessage({ type: 'error', text: 'يرجى ملء اسم الكنيسة وبيانات حساب المسؤول الرئيسي' });
      return;
    }

    const cleanAdminUsername = formData.admin_username.trim().toLowerCase();
    if (cleanAdminUsername === 'admin') {
      setMessage({
        type: 'error',
        text: 'اسم المستخدم (admin) محجوز حصرياً لمدير المنظومة العام (Super Admin)، يرجى اختيار اسم مستخدم آخر للكنيسة.',
      });
      return;
    }

    const existingChurch = churches.find(
      (c) => c.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
    );
    if (existingChurch) {
      setMessage({
        type: 'error',
        text: `توجد كنيسة مسجلة بالفعل بهذا الاسم (${formData.name.trim()})، يرجى اختيار اسم مميز أو إضافة المنطقة.`,
      });
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const payload = {
        name: formData.name,
        code: formData.code || formData.admin_username,
        diocese: formData.diocese,
        bishop_name: formData.bishop_name,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        verse: formData.verse,
        logo_url: formData.logo_url,
        social_links: {
          facebook: formData.facebook_url,
          youtube: formData.youtube_url,
          instagram: formData.instagram_url,
        },
        admin_name: formData.admin_name,
        admin_username: formData.admin_username,
        admin_password: formData.admin_password,
        admin_phone: formData.phone,
      };

      const res = await api.post<{ success: boolean; church: Church }>('/api/super-admin/churches', payload);
      setMessage({ type: 'success', text: `تم إنشاء كنيسة (${res.church.name}) وحساب المسؤول بنجاح!` });
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        code: '',
        diocese: '',
        bishop_name: '',
        address: '',
        phone: '',
        email: '',
        verse: '«أَمَّا أَنَا وَبَيْتِي فَنَعْبُدُ الرَّبَّ» (يشوع ٢٤ : ١٥)',
        logo_url: '',
        facebook_url: '',
        youtube_url: '',
        instagram_url: '',
        admin_username: '',
        admin_password: '',
        admin_name: '',
      });
      fetchChurches();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء إنشاء الكنيسة' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (church: ChurchWithStats) => {
    setSelectedChurch(church);
    setEditFormData({
      name: church.name || '',
      diocese: church.diocese || '',
      bishop_name: church.bishop_name || '',
      address: church.address || '',
      phone: church.phone || '',
      email: church.email || '',
      verse: church.verse || '',
      logo_url: church.logo_url || church.branding?.logo_url || '',
      facebook_url: church.social_links?.facebook || church.branding?.social_links?.facebook || '',
      youtube_url: church.social_links?.youtube || church.branding?.social_links?.youtube || '',
      instagram_url: church.social_links?.instagram || church.branding?.social_links?.instagram || '',
      admin_username: church.admin_info?.username || '',
      admin_password: '',
      admin_name: church.admin_info?.name || '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurch) return;

    setActionLoading(true);
    setMessage(null);
    try {
      const payload = {
        name: editFormData.name,
        diocese: editFormData.diocese,
        bishop_name: editFormData.bishop_name,
        address: editFormData.address,
        phone: editFormData.phone,
        email: editFormData.email,
        verse: editFormData.verse,
        logo_url: editFormData.logo_url,
        social_links: {
          facebook: editFormData.facebook_url,
          youtube: editFormData.youtube_url,
          instagram: editFormData.instagram_url,
        },
        admin_username: editFormData.admin_username.trim() || undefined,
        admin_password: editFormData.admin_password.trim() || undefined,
        admin_name: editFormData.admin_name.trim() || undefined,
      };

      await api.put(`/api/super-admin/churches/${selectedChurch.id}`, payload);
      setMessage({ type: 'success', text: `تم تحديث بيانات كنيسة (${editFormData.name}) وحساب الدخول بنجاح` });
      setIsEditModalOpen(false);
      fetchChurches();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء تحديث بيانات الكنيسة' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenResetPassword = (church: ChurchWithStats) => {
    setSelectedChurch(church);
    setNewAdminUsername(church.admin_info?.username || '');
    setNewAdminPassword('');
    setIsResetPassModalOpen(true);
  };

  const handleResetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurch) return;

    if (!newAdminUsername.trim() && !newAdminPassword.trim()) {
      setMessage({ type: 'error', text: 'يرجى إدخال اسم مستخدم أو كلمة مرور جديدة للتحديث' });
      return;
    }

    if (newAdminPassword && newAdminPassword.length < 3) {
      setMessage({ type: 'error', text: 'كلمة المرور يجب ألا تقل عن 3 أحرف' });
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      await api.post(`/api/super-admin/churches/${selectedChurch.id}/reset-admin-password`, {
        new_username: newAdminUsername.trim() || undefined,
        new_password: newAdminPassword.trim() || undefined,
      });
      setMessage({ type: 'success', text: `تم تحديث بيانات دخول أدمن كنيسة (${selectedChurch.name}) بنجاح!` });
      setIsResetPassModalOpen(false);
      fetchChurches();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل تحديث بيانات الدخول' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSubscriptionModal = (church: ChurchWithStats) => {
    setSelectedChurch(church);
    setSubFormData({
      plan: church.subscription?.plan || 'basic',
      payment_status: (church.subscription?.payment_status as any) || 'paid',
      fee: church.subscription?.fee ?? 500,
      last_payment_date: church.subscription?.last_payment_date || new Date().toISOString().split('T')[0],
      next_due_date: church.subscription?.next_due_date || '',
      notes: church.subscription?.notes || '',
    });
    setIsSubModalOpen(true);
  };

  const handleQuickRenewOneYear = () => {
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    setSubFormData((prev) => ({
      ...prev,
      payment_status: 'paid',
      last_payment_date: today.toISOString().split('T')[0],
      next_due_date: nextYear.toISOString().split('T')[0],
    }));
  };

  const handleSendRenewalAlert = async (church: ChurchWithStats) => {
    setSendingAlertChurchId(church.id);
    setMessage(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/api/super-admin/churches/${church.id}/send-renewal-alert`,
        {}
      );
      setMessage({
        type: 'success',
        text: res.message || `تم إرسال إشعار تجديد الاشتراك لكنيسة (${church.name}) بنجاح`,
      });
      fetchChurches();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'فشل إرسال إشعار التجديد',
      });
    } finally {
      setSendingAlertChurchId(null);
    }
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurch) return;

    setActionLoading(true);
    setMessage(null);
    try {
      await api.patch(`/api/super-admin/churches/${selectedChurch.id}/subscription`, {
        plan: subFormData.plan,
        payment_status: subFormData.payment_status,
        fee: Number(subFormData.fee) || 0,
        last_payment_date: subFormData.last_payment_date,
        next_due_date: subFormData.next_due_date,
        notes: subFormData.notes,
      });

      setMessage({
        type: 'success',
        text: `تم تحديث بيانات الاشتراك والمدفوعات لكنيسة (${selectedChurch.name}) بنجاح!`,
      });
      setIsSubModalOpen(false);
      fetchChurches();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء تحديث بيانات الاشتراك' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = (church: Church) => {
    const nextStatus = church.status === 'active' ? 'suspended' : 'active';
    setStatusModal({ church, nextStatus });
  };

  const handleExecuteToggleStatus = async () => {
    if (!statusModal) return;
    const { church, nextStatus } = statusModal;
    setStatusLoading(true);

    try {
      await api.patch(`/api/super-admin/churches/${church.id}/status`, { status: nextStatus });
      setChurches((prev) =>
        prev.map((c) => (c.id === church.id ? { ...c, status: nextStatus } : c))
      );
      setMessage({
        type: 'success',
        text: `تم ${nextStatus === 'active' ? 'تفعيل' : 'إيقاف'} كنيسة (${church.name}) بنجاح`,
      });
      setStatusModal(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء تحديث حالة الكنيسة' });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleOpenDeleteModal = (church: ChurchWithStats) => {
    setChurchToDelete(church);
    setDeleteConfirmName('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchToDelete) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/api/super-admin/churches/${churchToDelete.id}`);
      setChurches((prev) => prev.filter((c) => c.id !== churchToDelete.id));
      setIsDeleteModalOpen(false);
      setMessage({
        type: 'success',
        text: `تم حذف كنيسة (${churchToDelete.name}) وكافة بياناتها نهائياً بنجاح`,
      });
      setChurchToDelete(null);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'فشل حذف الكنيسة',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // KPI Calculations for Super Admin
  const totalChurchesCount = churches.length;
  const paidChurchesCount = churches.filter((c) => c.subscription?.payment_status === 'paid').length;
  const unpaidChurchesCount = churches.filter(
    (c) => c.subscription?.payment_status === 'unpaid' || c.subscription?.payment_status === 'overdue'
  ).length;
  const trialChurchesCount = churches.filter((c) => c.subscription?.payment_status === 'trial').length;
  const suspendedChurchesCount = churches.filter((c) => c.status === 'suspended').length;
  const totalServantsAcrossChurches = churches.reduce((acc, c) => acc + (c.servants_count || 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueSoonChurches = churches.filter((c) => {
    if (!c.subscription?.next_due_date) return false;
    const dueDate = new Date(c.subscription.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  });

  const overdueChurches = churches.filter((c) => {
    if (c.subscription?.payment_status === 'overdue') return true;
    if (!c.subscription?.next_due_date) return false;
    const dueDate = new Date(c.subscription.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() < today.getTime() && c.subscription.payment_status !== 'paid';
  });

  const alertChurchesCount = dueSoonChurches.length + overdueChurches.length;

  const filteredChurches = churches.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.diocese && c.diocese.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.admin_info?.username && c.admin_info.username.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'paid') return c.subscription?.payment_status === 'paid';
    if (statusFilter === 'unpaid')
      return c.subscription?.payment_status === 'unpaid' || c.subscription?.payment_status === 'overdue';
    if (statusFilter === 'trial') return c.subscription?.payment_status === 'trial';
    if (statusFilter === 'suspended') return c.status === 'suspended';

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Super Admin Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-700 via-amber-800 to-stone-900 text-white p-6 sm:p-8 shadow-xl border border-amber-600/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>لوحة الإدارة المركزية والتحكم العام (Super Admin)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-serif tracking-tight">
              أهلاً بك {user?.name || 'م/ أبانوب وجيه'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
              هذه هي صفحتك المخصصة بصفتك المدير العام ومسؤول المنظومة. يمكنك هنا إنشاء كنائس جديدة بالكامل،
              تحديد حسابات مسؤولي كل كنيسة، وتعديل بيانات وروابط الكنائس وفحص بياناتها بكل سهولة.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              id="btn-super-admin-smtp-settings"
              onClick={() => {
                fetchSmtpSettings();
                setIsSmtpModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-stone-950/80 hover:bg-stone-950 text-amber-300 border border-amber-500/40 hover:border-amber-400 font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              <Mail className="w-4 h-4 text-amber-400" />
              <span>إعدادات البريد (SMTP)</span>
            </button>

            <button
              id="btn-super-admin-account-settings"
              onClick={openAccountModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-stone-950/80 hover:bg-stone-950 text-amber-300 border border-amber-500/40 hover:border-amber-400 font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>إعدادات حسابي</span>
            </button>

            <button
              id="btn-super-admin-add-church"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm transition-all shadow-lg hover:shadow-amber-500/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إنشاء كنيسة جديدة الآن</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Platform Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">إجمالي الكنائس المسجلة</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white mt-1">{totalChurchesCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">المسددون للاشتراك</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {paidChurchesCount}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">متأخرات ومطلوب تجديد</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {unpaidChurchesCount}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">إجمالي الخدام بالمنظومة</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {totalServantsAcrossChurches}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Subscription Expiry & Renewal Alerts Center for Super Admin */}
      {alertChurchesCount > 0 && !isAlertsDismissed && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-stone-950 font-bold shadow-xs">
                <Bell className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200 font-serif flex items-center gap-2">
                  <span>مركز تنبيهات استحقاق وتجديد اشتراكات الكنائس</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                    {alertChurchesCount} {alertChurchesCount === 1 ? 'كنيسة تحتاج متابعة' : 'كنائس تحتاج متابعة'}
                  </span>
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                  كنائس حل موعد تجديد اشتراكها أو اقترب استحقاقه خلال 14 يوماً. يمكنك إرسال إشعار تذكير داخلي مباشر للوحة الكنيسة أو تسجيل السداد والتجديد.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAlertsDismissed(true)}
              className="text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 self-end sm:self-center cursor-pointer p-1"
              title="إخفاء التنبيهات مؤقتاً"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
            {[...overdueChurches, ...dueSoonChurches].map((c) => {
              const isOver =
                c.subscription?.payment_status === 'overdue' ||
                (c.subscription?.next_due_date && new Date(c.subscription.next_due_date).getTime() < today.getTime());
              const hasActiveNotice = c.subscription?.renewal_notice && !c.subscription?.renewal_notice.acknowledged;

              return (
                <div
                  key={`alert-${c.id}`}
                  className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">
                          {c.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOver
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {isOver ? '⚠️ متأخر عن موعد السداد' : '🔔 يستحق التجديد قريباً'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        تاريخ الاستحقاق:{' '}
                        <strong className="text-stone-700 dark:text-stone-200">
                          {c.subscription?.next_due_date || 'غير محدد'}
                        </strong>
                        {c.subscription?.fee ? ` | القيمة: ${c.subscription.fee} ج.م` : ''}
                      </p>
                      {c.admin_info && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          أدمن الكنيسة: {c.admin_info.name} ({c.admin_info.phone || c.phone || 'بدون هاتف'})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-stone-500">
                      {hasActiveNotice ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم إرسال إشعار تذكير للكنيسة</span>
                        </span>
                      ) : (
                        <span className="text-stone-400">لم يُرسل إشعار تذكير</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendRenewalAlert(c)}
                        disabled={sendingAlertChurchId === c.id}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="إرسال إشعار تذكير داخل لوحة الكنيسة"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingAlertChurchId === c.id ? 'إرسال...' : 'إرسال تذكير'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenSubscriptionModal(c)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title="تسجيل استلام الرسوم والتجديد لسنة"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>تسجيل السداد</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Churches List Section */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white font-serif">
                إدارة الكنائس والاشتراكات
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                فحص ومتابعة حالة السداد، الخدام المسجلين، والدخول لإدارة أي كنيسة
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-stone-400 absolute start-3 top-3" />
              <input
                type="text"
                placeholder="بحث باسم الكنيسة، الإيبارشية، أو المسؤول..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-600"
              />
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              الكل ({totalChurchesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'paid'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>مسدد ({paidChurchesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>متأخرات وتجديد ({unpaidChurchesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('trial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'trial'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>فترة تجريبية ({trialChurchesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('suspended')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'suspended'
                  ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'
              }`}
            >
              موقوفة ({suspendedChurchesCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-stone-500 mt-2">جاري تحميل قائمة الكنائس...</p>
          </div>
        ) : filteredChurches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto" />
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
              {searchTerm ? 'لم يتم العثور على كنائس تطابق بحثك' : 'لا توجد كنائس مسجلة حالياً'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء أول كنيسة الآن</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800/60">
            {filteredChurches.map((church) => (
              <div
                key={church.id}
                className="p-5 sm:p-6 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    {church.logo_url || church.branding?.logo_url ? (
                      <img
                        src={church.logo_url || church.branding?.logo_url}
                        alt={church.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Cross className="w-6 h-6 text-amber-600" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white font-serif">
                        {church.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          church.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {church.status === 'active' ? 'نشطة' : 'موقوفة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
                      {church.diocese && (
                        <span className="flex items-center gap-1 font-medium">
                          <Shield className="w-3.5 h-3.5 text-amber-600" />
                          إيبارشية {church.diocese}
                        </span>
                      )}
                      {church.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          {church.phone}
                        </span>
                      )}
                      {church.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400" />
                          {church.address}
                        </span>
                      )}
                    </div>

                    {/* Church Admin details badge with username and password reveal */}
                    {church.admin_info && (
                      <div className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-xs flex-wrap">
                        <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-stone-600 dark:text-stone-300 font-semibold">
                          مسؤول الكنيسة: <strong className="text-stone-900 dark:text-white">{church.admin_info.name}</strong>
                        </span>
                        <span className="text-stone-300 dark:text-stone-600">|</span>
                        <span className="text-stone-500 dark:text-stone-400">اسم المستخدم:</span>
                        <div className="inline-flex items-center gap-1 font-mono">
                          <span className="font-bold text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 select-all">
                            {church.admin_info.username}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyTextToClipboard(church.admin_info?.username || '', `user-${church.id}`)}
                            className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                            title="نسخ اسم المستخدم"
                          >
                            {copiedKey === `user-${church.id}` ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span className="text-stone-300 dark:text-stone-600">|</span>
                        <span className="text-stone-500 dark:text-stone-400">كلمة المرور:</span>
                        {church.admin_info.password_hint ? (
                          <div className="inline-flex items-center gap-1 font-mono">
                            <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700/60 font-bold select-all">
                              {revealedPasswords[church.id] ? church.admin_info.password_hint : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(church.id)}
                              className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                              title={revealedPasswords[church.id] ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                            >
                              {revealedPasswords[church.id] ? (
                                <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyTextToClipboard(church.admin_info?.password_hint || '', `pwd-${church.id}`)}
                              className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                              title="نسخ كلمة المرور"
                            >
                              {copiedKey === `pwd-${church.id}` ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChurch(church);
                              setNewAdminUsername(church.admin_info?.username || '');
                              setNewAdminPassword('');
                              setIsResetPassModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>عرض / إعادة تعيين كلمة المرور</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Operational Servants & Subscription badges */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-xs font-bold inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{church.servants_count ?? 0} خادم مسجل</span>
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border ${
                          church.subscription?.payment_status === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                            : church.subscription?.payment_status === 'trial'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {church.subscription?.payment_status === 'paid'
                            ? `اشتراك مسدد (${church.subscription?.fee ?? 500} ج.م)`
                            : church.subscription?.payment_status === 'trial'
                            ? 'فترة تجريبية مجانية'
                            : `مطلوب سداد الاشتراك (${church.subscription?.fee ?? 500} ج.م)`}
                        </span>
                      </span>

                      {church.subscription?.next_due_date && (
                        <span className="text-[11px] text-stone-500 dark:text-stone-400 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span>التجديد: {church.subscription.next_due_date}</span>
                        </span>
                      )}

                      {church.subscription?.renewal_notice && !church.subscription.renewal_notice.acknowledged && (
                        <span className="text-[11px] text-purple-700 dark:text-purple-300 font-bold inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                          <Bell className="w-3 h-3" />
                          <span>تم إرسال إشعار تذكير</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions buttons */}
                <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                  <button
                    type="button"
                    onClick={() => handleSendRenewalAlert(church)}
                    disabled={sendingAlertChurchId === church.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-bold transition-all cursor-pointer border border-amber-200 dark:border-amber-800 disabled:opacity-50"
                    title="إرسال إشعار تذكير بتجديد الاشتراك داخل لوحة الكنيسة"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingAlertChurchId === church.id ? 'إرسال...' : 'إرسال تذكير'}</span>
                  </button>

                  <button
                    type="button"
                    id={`btn-church-sub-${church.id}`}
                    onClick={() => handleOpenSubscriptionModal(church)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800"
                    title="تعديل باقة الاشتراك وحالة سداد المدفوعات"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>الاشتراك والدفع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(church)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-all cursor-pointer"
                    title="تعديل بيانات الكنيسة وروابطها"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenResetPassword(church)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-800 dark:text-amber-300 text-xs font-semibold transition-all cursor-pointer"
                    title="تغيير كلمة مرور أدمن الكنيسة"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>كلمة المرور</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(church)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      church.status === 'active'
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300'
                    }`}
                  >
                    {church.status === 'active' ? 'إيقاف' : 'تفعيل'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(church)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-all cursor-pointer border border-rose-200 dark:border-rose-900/50"
                    title="حذف الكنيسة نهائياً وكافة بياناتها التابعة لها"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Church Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-xl w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white font-serif">
                    إنشاء كنيسة جديدة وحساب مسؤولها
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    أدخل بيانات الكنيسة وحساب الدخول الخاص بأدمن الكنيسة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChurch} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 border-b border-stone-100 dark:border-stone-800 pb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>بيانات الكنيسة الأساسية</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    اسم الكنيسة *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: كنيسة السيدة العذراء مريم بالزيتون"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      الإيبارشية
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: شبين القناطر وتوابعها"
                      value={formData.diocese}
                      onChange={(e) => setFormData({ ...formData, diocese: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      اسم الأب الأسقف / المطران
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: نيافة الأنبا نوفير أو الأنبا مكسيموس"
                      value={formData.bishop_name}
                      onChange={(e) => setFormData({ ...formData, bishop_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    هاتف الكنيسة
                  </label>
                  <input
                    type="text"
                    placeholder="01234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    العنوان
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: الزيتون، القاهرة"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    آية الكنيسة (الظاهرة في الفوتر وكارنيهات الخدام)
                  </label>
                  <input
                    type="text"
                    placeholder="«أَمَّا أَنَا وَبَيْتِي فَنَعْبُدُ الرَّبَّ»"
                    value={formData.verse}
                    onChange={(e) => setFormData({ ...formData, verse: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <LogoUploader
                    value={formData.logo_url}
                    onChange={(url) => setFormData({ ...formData, logo_url: url })}
                    label="شعار / لوجو الكنيسة (اختياري)"
                    hint="اختر صورة الشعار من جهازك (PNG, JPG, SVG) أو اتركه لاستخدام الصليب الذهبي"
                  />
                </div>
              </div>

              {/* Church Admin User Details */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 border-b border-stone-100 dark:border-stone-800 pb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>بيانات حساب مسؤول الكنيسة الرئيسي (Church Admin)</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    اسم المسؤول بالكامل *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أستاذ مايكل نبيل"
                    value={formData.admin_name}
                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      اسم المستخدم للدخول (Username) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="admin_zeitoun"
                      value={formData.admin_username}
                      onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      كلمة المرور (Password) *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media Links */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 border-b border-stone-100 dark:border-stone-800 pb-1 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>روابط التواصل الاجتماعي للكنيسة (تظهر في الفوتر لمستخدمي الكنيسة)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      رابط فيسبوك
                    </label>
                    <input
                      type="url"
                      placeholder="https://facebook.com/..."
                      value={formData.facebook_url}
                      onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      رابط يوتيوب
                    </label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/..."
                      value={formData.youtube_url}
                      onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      رابط انستجرام
                    </label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/..."
                      value={formData.instagram_url}
                      onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-5 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-700 hover:bg-amber-800 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'جاري الإنشاء...' : 'حفظ وإنشاء الكنيسة الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Church Modal */}
      {isEditModalOpen && selectedChurch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-xl w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 mb-5">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
                  تعديل بيانات كنيسة ({selectedChurch.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateChurch} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  اسم الكنيسة *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    الإيبارشية
                  </label>
                  <input
                    type="text"
                    value={editFormData.diocese}
                    onChange={(e) => setEditFormData({ ...editFormData, diocese: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    اسم الأب الأسقف / المطران
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: نيافة الأنبا نوفير أو الأنبا مكسيموس"
                    value={editFormData.bishop_name}
                    onChange={(e) => setEditFormData({ ...editFormData, bishop_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  هاتف الكنيسة
                </label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  العنوان
                </label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  آية الكنيسة
                </label>
                <input
                  type="text"
                  value={editFormData.verse}
                  onChange={(e) => setEditFormData({ ...editFormData, verse: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <LogoUploader
                  value={editFormData.logo_url}
                  onChange={(url) => setEditFormData({ ...editFormData, logo_url: url })}
                  label="شعار / لوجو الكنيسة"
                  hint="اختر ملف صورة الشعار لتحديثه أو اسحبه هنا"
                />
              </div>

              {/* Church Admin Account Credentials */}
              <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    بيانات دخول مسؤول الكنيسة (اسم المستخدم وكلمة المرور)
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      اسم المستخدم (Username)
                    </label>
                    <input
                      type="text"
                      value={editFormData.admin_username}
                      onChange={(e) => setEditFormData({ ...editFormData, admin_username: e.target.value })}
                      placeholder="اسم المستخدم للدخول..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-stone-500 mt-1">
                      اسم الدخول الحالي للمسؤول في لوحة الكنيسة
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      كلمة المرور الجديدة (اختياري)
                    </label>
                    <input
                      type="password"
                      value={editFormData.admin_password}
                      onChange={(e) => setEditFormData({ ...editFormData, admin_password: e.target.value })}
                      placeholder="اتركه فارغاً دون تغيير..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                    />
                    <p className="text-[10px] text-stone-500 mt-1">
                      اتركه فارغاً للحفاظ على كلمة المرور الحالية
                    </p>
                  </div>
                </div>
              </div>

              {/* Social links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    فيسبوك
                  </label>
                  <input
                    type="url"
                    value={editFormData.facebook_url}
                    onChange={(e) => setEditFormData({ ...editFormData, facebook_url: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    يوتيوب
                  </label>
                  <input
                    type="url"
                    value={editFormData.youtube_url}
                    onChange={(e) => setEditFormData({ ...editFormData, youtube_url: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    انستجرام
                  </label>
                  <input
                    type="url"
                    value={editFormData.instagram_url}
                    onChange={(e) => setEditFormData({ ...editFormData, instagram_url: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-700 hover:bg-amber-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Admin Password Modal */}
      {isResetPassModalOpen && selectedChurch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-700" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white font-serif">
                  تعديل بيانات دخول أدمن ({selectedChurch.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPassModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetAdminPassword} className="space-y-4">
              {/* Current Credentials Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600 dark:text-stone-400 font-semibold">اسم المستخدم الحالي:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="font-bold text-stone-900 dark:text-white bg-white dark:bg-stone-900 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 select-all">
                      {selectedChurch.admin_info?.username || 'غير محدد'}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyTextToClipboard(selectedChurch.admin_info?.username || '', 'modal-user')}
                      className="p-1 rounded text-stone-500 hover:text-stone-800 dark:text-stone-300 cursor-pointer"
                      title="نسخ اسم المستخدم"
                    >
                      {copiedKey === 'modal-user' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600 dark:text-stone-400 font-semibold">كلمة المرور الحالية:</span>
                  {selectedChurch.admin_info?.password_hint ? (
                    <div className="flex items-center gap-1 font-mono">
                      <span className="font-bold text-amber-900 dark:text-amber-200 bg-white dark:bg-stone-900 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 select-all">
                        {revealedPasswords['modal-pwd'] ? selectedChurch.admin_info.password_hint : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('modal-pwd')}
                        className="p-1 rounded text-stone-500 hover:text-stone-800 dark:text-stone-300 cursor-pointer"
                        title={revealedPasswords['modal-pwd'] ? 'إخفاء' : 'إظهار'}
                      >
                        {revealedPasswords['modal-pwd'] ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyTextToClipboard(selectedChurch.admin_info?.password_hint || '', 'modal-pwd')}
                        className="p-1 rounded text-stone-500 hover:text-stone-800 dark:text-stone-300 cursor-pointer"
                        title="نسخ كلمة المرور"
                      >
                        {copiedKey === 'modal-pwd' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-stone-500 dark:text-stone-400 italic text-[11px]">
                      مشفرة بالكامل - يمكنك تعيين كلمة مرور جديدة بالأسفل
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-stone-500 dark:text-stone-400">
                يمكنك تعديل اسم المستخدم (Username) أو تعيين كلمة مرور جديدة لحساب مسؤول الكنيسة:
              </p>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  اسم المستخدم (Username)
                </label>
                <input
                  type="text"
                  placeholder="اسم المستخدم للدخول..."
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  كلمة المرور الجديدة (اختياري عند تغيير اسم المستخدم فقط)
                </label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الجديدة أو اتركها فارغة..."
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  اترك كلمة المرور فارغة إذا كنت تريد تعديل اسم المستخدم فقط
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsResetPassModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-700 hover:bg-amber-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'جاري التحديث...' : 'تأكيد التعديل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription & Payment Management Modal */}
      {isSubModalOpen && selectedChurch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white font-serif">
                    إدارة اشتراك ومدفوعات ({selectedChurch.name})
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    تعديل الباقة، قيمة الاشتراك الشهري/السنوي، ومتابعة حالة السداد
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    باقة الاشتراك
                  </label>
                  <select
                    value={subFormData.plan}
                    onChange={(e) => setSubFormData({ ...subFormData, plan: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="basic">الباقة الأساسية (Basic)</option>
                    <option value="pro">الباقة المتقدمة (Pro)</option>
                    <option value="enterprise">الباقة الشاملة / إيبارشية (Enterprise)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    حالة السداد
                  </label>
                  <select
                    value={subFormData.payment_status}
                    onChange={(e) => setSubFormData({ ...subFormData, payment_status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 font-bold"
                  >
                    <option value="paid">🟢 مسدد بالكامل (Paid)</option>
                    <option value="trial">🟡 فترة تجريبية مجانية (Trial)</option>
                    <option value="unpaid">🔴 غير مسدد (Unpaid)</option>
                    <option value="overdue">⚠️ متأخر عن موعد السداد (Overdue)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    قيمة الاشتراك (بالجنيه المصري)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={subFormData.fee}
                      onChange={(e) => setSubFormData({ ...subFormData, fee: Number(e.target.value) })}
                      className="w-full ps-3 pe-12 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-600"
                    />
                    <span className="absolute end-3 top-2 text-xs text-stone-400 font-bold pointer-events-none">
                      ج.م
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    تاريخ الاستحقاق / التجديد القادم
                  </label>
                  <input
                    type="date"
                    value={subFormData.next_due_date}
                    onChange={(e) => setSubFormData({ ...subFormData, next_due_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  تاريخ آخر سداد
                </label>
                <input
                  type="date"
                  value={subFormData.last_payment_date}
                  onChange={(e) => setSubFormData({ ...subFormData, last_payment_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات السداد والتحويل
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: تم التحويل عبر فودافون كاش أو إنستاباي، المسؤول م/ فلوباتير..."
                  value={subFormData.notes}
                  onChange={(e) => setSubFormData({ ...subFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 resize-none"
                />
              </div>

              {/* Quick 1-Year Renewal Preset */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>تجديد سريع لسنة كاملة مسددة</span>
                  </h5>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                    يقوم تلقائياً بتعيين الحالة "مسدد"، تاريخ السداد اليوم، وتاريخ الاستحقاق بعد عام.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickRenewOneYear}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 shadow-xs cursor-pointer"
                >
                  تطبيق لسنة الآن
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'جاري الحفظ...' : 'حفظ بيانات الاشتراك والمدفوعات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Account & Password Settings Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full flex flex-col max-h-[88vh] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3.5 border-b border-stone-200 dark:border-stone-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
                    إعدادات حساب المدير العام
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    تعديل الاسم، اسم المستخدم، أو كلمة المرور الخاصة بحسابك
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateAccount} className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* Scrollable Body */}
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1">
                {accountError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{accountError}</span>
                  </div>
                )}

                {accountSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{accountSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    الاسم المعروض
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormData.name}
                    onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                    placeholder="م/ أبانوب وجيه"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    اسم المستخدم لتسجيل الدخول
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormData.username}
                    onChange={(e) => setAccountFormData({ ...accountFormData, username: e.target.value })}
                    placeholder="admin"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    هذا هو الاسم الذي تستخدمه في صفحة تسجيل الدخول للمدير العام.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    البريد الإلكتروني (لاستعادة كلمة المرور وإشعارات الأمان)
                  </label>
                  <input
                    type="email"
                    required
                    value={accountFormData.email}
                    onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
                    placeholder="abanoub.wagih77@gmail.com"
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 font-mono text-left"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    يُستخدم هذا البريد لاستلام كود التحقق السري في حال نسيت كلمة المرور.
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mb-2">
                    تغيير كلمة المرور (اختياري)
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-stone-600 dark:text-stone-400 mb-1">
                        كلمة المرور الحالية (مطلوبة فقط عند تغيير كلمة المرور)
                      </label>
                      <input
                        type="password"
                        value={accountFormData.current_password}
                        onChange={(e) => setAccountFormData({ ...accountFormData, current_password: e.target.value })}
                        placeholder="أدخل كلمة المرور الحالية"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-stone-600 dark:text-stone-400 mb-1">
                        كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        value={accountFormData.new_password}
                        onChange={(e) => setAccountFormData({ ...accountFormData, new_password: e.target.value })}
                        placeholder="أدخل كلمة المرور الجديدة"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Face ID Section */}
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700/70">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <ScanFace className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            بصمة الوجه (Face ID)
                          </h4>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400">
                            {isFaceEnrolled ? 'مفعلة لحسابك لتسجيل الدخول السريع' : 'غير مسجلة حالياً'}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isFaceEnrolled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-400'
                      }`}>
                        {isFaceEnrolled ? 'مفعلة ✅' : 'غير مفعلة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-200/60 dark:border-stone-700/50">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountModalOpen(false);
                          setIsFaceScannerOpen(true);
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isFaceEnrolled ? 'تحديث البصمة' : 'تسجيل بصمة الوجه الآن'}</span>
                      </button>

                      {isFaceEnrolled && (
                        <button
                          type="button"
                          onClick={handleRemoveFaceId}
                          disabled={faceActionLoading}
                          className="py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-semibold text-[11px] transition-all border border-rose-200 dark:border-rose-800 cursor-pointer"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 p-3.5 sm:p-4 border-t border-stone-200 dark:border-stone-800 shrink-0 bg-stone-50/70 dark:bg-stone-900/70">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={accountLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{accountLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Church Confirmation Modal */}
      {isDeleteModalOpen && churchToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white font-serif">
                    حذف الكنيسة نهائياً
                  </h3>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    تحذير: هذا الإجراء جذري ولا يمكن التراجع عنه
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteChurch} className="space-y-4">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-2 leading-relaxed">
                <p className="font-bold">
                  هل أنت متأكد من رغبتك في مسح كنيسة ({churchToDelete.name}) بالكامل من على السيستم؟
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  سيؤدي هذا الإجراء إلى حذف الكنيسة نهائياً ومسح كافة البيانات المرتبطة بها تماماً (جميع الخدام، المراحل والخدمات، سجلات الحضور، الاجتماعات، وأجهزة السكانر وحسابات المسؤولين التابعة لهذه الكنيسة فقط)، حتى تبدأ الكنائس الجديدة بسجل نظيف وخالٍ تماماً.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  لتأكيد الحذف النهائي، اكتب اسم الكنيسة أدناه:
                </label>
                <p className="text-[11px] text-stone-500 font-mono mb-2 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg select-all">
                  {churchToDelete.name}
                </p>
                <input
                  type="text"
                  required
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="اكتب اسم الكنيسة للتأكيد..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-rose-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmName.trim() !== churchToDelete.name.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteLoading ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Status Toggle Confirmation Modal (Replaces window.confirm) */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  statusModal.nextStatus === 'suspended'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {statusModal.nextStatus === 'suspended' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
                  {statusModal.nextStatus === 'suspended' ? 'تأكيد إيقاف الكنيسة' : 'تأكيد إعادة تفعيل الكنيسة'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {statusModal.church.name}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
              {statusModal.nextStatus === 'suspended' ? (
                <p>
                  عند إيقاف كنيسة <span className="font-bold text-stone-900 dark:text-white">({statusModal.church.name})</span>،
                  سيتم تعليق دخول مسؤولي الكنيسة والخدام مؤقتاً حتى تقوم بإعادة تفعيلها مجدداً، مع الحفاظ الكامل على كافة البيانات
                  والسجلات.
                </p>
              ) : (
                <p>
                  سيتم إعادة تفعيل كنيسة <span className="font-bold text-stone-900 dark:text-white">({statusModal.church.name})</span> فوراً،
                  وسيتمكن كافة الخدام ومسؤولي الكنيسة من تسجيل الدخول والمتابعة بصورة طبيعية.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                disabled={statusLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleExecuteToggleStatus}
                disabled={statusLoading}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                  statusModal.nextStatus === 'suspended'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                {statusLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>{statusModal.nextStatus === 'suspended' ? 'نعم، قم بالإيقاف الآن' : 'نعم، قم بالتفعيل الآن'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Face ID Camera Enrollment Modal */}
      <FaceScannerModal
        isOpen={isFaceScannerOpen}
        onClose={() => setIsFaceScannerOpen(false)}
        mode="enroll"
        onScanComplete={handleEnrollFaceComplete}
        title="تسجيل وتفعيل بصمة الوجه (Face ID)"
        subtitle="ضع وجهك داخل الإطار ليتم التقاط بصمة الوجه الرقمية المشفرة لحسابك"
      />

      {/* SMTP Email Server Settings Modal */}
      {isSmtpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white font-serif">
                    إعدادات خادم البريد الإلكتروني (SMTP)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    لإرسال رموز استعادة كلمة المرور والإشعارات مباشرة إلى صندوق بريدك (Gmail)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSmtpModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSmtpSettings} className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-stone-700 dark:text-stone-300 space-y-1">
                <span className="font-bold text-amber-700 dark:text-amber-400 block">
                  💡 للمستخدمين عبر Gmail:
                </span>
                <p className="text-[11px] leading-relaxed">
                  استخدم بريدك الجيميل، وفي خانة كلمة المرور ضع <strong>كلمة مرور التطبيقات (App Password)</strong> المكونة من 16 حرفاً من حساب جوجل الخاص بك (وليس كلمة مرور الحساب العادية).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    خادم البريد (Host)
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    المنفذ (Port)
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                    placeholder="465"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  البريد الإلكتروني للإرسال (User / Email)
                </label>
                <input
                  type="email"
                  required
                  value={smtpForm.user}
                  onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                  placeholder="abanoub.wagih77@gmail.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  كلمة المرور / كلمة مرور التطبيقات (App Password)
                </label>
                <input
                  type="password"
                  value={smtpForm.pass}
                  onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                  placeholder="اتركها فارغة إذا كانت محفوظة بالفعل أو أدخل كلمة سر جديدة..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  يتم حفظها بأمان تام ومحلياً ولا تُشارك مطلقاً.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  اسم وعنوان المُرسل (From Display)
                </label>
                <input
                  type="text"
                  value={smtpForm.from}
                  onChange={(e) => setSmtpForm({ ...smtpForm, from: e.target.value })}
                  placeholder='"نظام إدارة خدمة الكنائس" <abanoub.wagih77@gmail.com>'
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSmtpModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={smtpLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {smtpLoading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
