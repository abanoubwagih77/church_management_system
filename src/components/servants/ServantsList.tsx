import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { Servant, ChurchService } from '../../types/index.js';
import { ServiceFormModal } from '../services/ServicesList.js';
import { ServantTransferModal } from './ServantTransferModal.js';
import { ServantIdCardModal } from './ServantIdCardModal.js';
import { BulkPrintIdCardsModal } from './BulkPrintIdCardsModal.js';
import { CreateAdminAccountModal } from './CreateAdminAccountModal.js';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  FileDown,
  Shield,
  ShieldCheck,
  Phone,
  Calendar,
  Layers,
  Award,
  AlertCircle,
  X,
  Check,
  Clock,
  IdCard,
  ArrowRightLeft,
  QrCode,
} from 'lucide-react';

interface ServantsListProps {
  initialOpenAdd?: boolean;
  onClearInitialAdd?: () => void;
}

export const ServantsList: React.FC<ServantsListProps> = ({
  initialOpenAdd = false,
  onClearInitialAdd,
}) => {
  const { user, hasPermission } = useAuth();
  const { t, language } = useLanguage();

  const [servants, setServants] = useState<any[]>([]);
  const [services, setServices] = useState<ChurchService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedGender, setSelectedGender] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(initialOpenAdd);
  const [editingServant, setEditingServant] = useState<Servant | null>(null);
  const [viewingServantId, setViewingServantId] = useState<string | null>(null);
  const [servantDetails, setServantDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deletingServant, setDeletingServant] = useState<Servant | null>(null);
  const [transferringServant, setTransferringServant] = useState<Servant | null>(null);

  // Secure ID card viewer
  const [idCardModal, setIdCardModal] = useState<{ open: boolean; photo?: string; name?: string }>({
    open: false,
  });

  // Servant ID Badge (QR Code) modals
  const [idBadgeServant, setIdBadgeServant] = useState<Servant | null>(null);
  const [isBulkPrintBadgesOpen, setIsBulkPrintBadgesOpen] = useState(false);

  // Admin Account creation modal for newly appointed secretaries
  const [adminAccountTarget, setAdminAccountTarget] = useState<{
    servantId?: string;
    fullName: string;
    phone: string;
    serviceId: string;
    role: string;
  } | null>(null);

  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);

  const fetchServices = async () => {
    try {
      const res = await api.get<{ success: boolean; services: ChurchService[] }>('/api/services');
      setServices(res.services);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServants = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (selectedService) params.append('service_id', selectedService);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedGender) params.append('gender', selectedGender);

      const res = await api.get<{ success: boolean; servants: any[] }>(`/api/servants?${params.toString()}`);
      setServants(res.servants);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب قائمة الخدام');
    } finally {
      setLoading(false);
    }
  }, [search, selectedService, selectedStatus, selectedGender]);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    fetchServants();
  }, [fetchServants]);

  const handleToggleStatus = async (servant: any) => {
    try {
      await api.patch(`/api/servants/${servant.id}/status`);
      fetchServants();
    } catch (err: any) {
      alert(err.message || 'تعذر تغيير حالة الخادم');
    }
  };

  const handleDelete = async () => {
    if (!deletingServant) return;
    try {
      await api.delete(`/api/servants/${deletingServant.id}`);
    } catch (err: any) {
      console.warn('Delete servant network warning:', err);
    } finally {
      setDeletingServant(null);
      fetchServants();
    }
  };

  const openViewProfile = async (id: string) => {
    setViewingServantId(id);
    setLoadingDetails(true);
    try {
      const res = await api.get<{ success: boolean; servant: any; attendance_stats: any; assignments: any[]; recent_attendance: any[]; has_id_card: boolean }>(
        `/api/servants/${id}`
      );
      setServantDetails(res);
    } catch (err: any) {
      alert(err.message || 'تعذر تحميل بيانات الخادم');
      setViewingServantId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewIdCard = async (servantId: string) => {
    try {
      const res = await api.get<{ success: boolean; photo: string; servant_name: string }>(
        `/api/servants/${servantId}/id-card`
      );
      setIdCardModal({ open: true, photo: res.photo, name: res.servant_name });
    } catch (err: any) {
      alert(err.message || 'غير مصرح بعرض صورة البطاقة');
    }
  };

  const handleExportCsv = () => {
    if (servants.length === 0) return;
    const headers = ['Name', 'Phone', 'Service', 'Role', 'Status', 'Attendance Rate'];
    const rows = servants.map((s) => [
      `"${s.full_name}"`,
      `"${s.phone}"`,
      `"${s.service_name}"`,
      `"${s.current_role}"`,
      `"${s.status}"`,
      `"${s.attendance_rate}%"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `servants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            {t('servants_title')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {t('servants_desc')} ({servants.length} {language === 'ar' ? 'خادم مسجل' : 'servants'})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {servants.length > 0 && (
            <>
              <button
                onClick={() => setIsBulkPrintBadgesOpen(true)}
                className="px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="طباعة وتجهيز كارنيهات الخدام مع كود الـ QR للقص والتغليف"
              >
                <QrCode className="w-4 h-4" />
                <span>طباعة الكارنيهات (A4)</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>{t('common_export')}</span>
              </button>
            </>
          )}

          {hasPermission('add_servant') && (
            <button
              id="btn-add-servant-modal"
              onClick={() => setIsAddOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('servant_add_new')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice if no services exist yet */}
      {services.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <Layers className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {language === 'ar' ? 'لم تقم بتسجيل أي خدمات أو مراحل كنسية بعد' : 'No church services added yet'}
              </h4>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                {language === 'ar'
                  ? 'يُنصح بإضافة المراحل الكنسية (حضانة، ابتدائي، إعدادي بنين وبنات، ثانوي، اجتماعات عامة...) لتتمكن من إسناد الخدام إليها بسهولة.'
                  : 'Add church stages first (Nursery, Primary, Prep, Secondary, etc.) to assign servants to their respective services.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAddServiceModalOpen(true)}
            className="self-end sm:self-center shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إضافة مرحلة / خدمة الآن' : 'Add Service Now'}</span>
          </button>
        </div>
      )}

      {/* Filters Card */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common_search')}
            className="w-full ps-9 pe-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-stone-400 absolute start-3 top-2.5 pointer-events-none" />
        </div>

        {/* Service filter */}
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
        >
          <option value="">{language === 'ar' ? 'كافة الخدمات' : 'All Services'}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name_ar}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
        >
          <option value="">{language === 'ar' ? 'كافة الحالات' : 'All Statuses'}</option>
          <option value="active">{t('servant_status_active')}</option>
          <option value="inactive">{t('servant_status_inactive')}</option>
        </select>

        {/* Gender filter */}
        <select
          value={selectedGender}
          onChange={(e) => setSelectedGender(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
        >
          <option value="">{language === 'ar' ? 'النوع (الكل)' : 'All Genders'}</option>
          <option value="male">{t('servant_male')}</option>
          <option value="female">{t('servant_female')}</option>
        </select>
      </div>

      {/* Servants Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-stone-500">{t('common_loading')}</span>
          </div>
        ) : servants.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Shield className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">
              {t('common_no_data')}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
              {language === 'ar'
                ? 'لا توجد بيانات خدام مسجلة حتى الآن. بصفتك Super Admin، ابدأ بالضغط على زر "إضافة خادم جديد" لملء سجل الكنيسة.'
                : 'No servants are registered yet. As Super Admin, click "Add New Servant" to start populating your church roster.'}
            </p>
            {hasPermission('add_servant') && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                {t('servant_add_new')}
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Mobile Responsive Cards View */}
            <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800">
              {servants.map((s) => (
                <div key={s.id} className="p-4 space-y-3 bg-white dark:bg-stone-900">
                  {/* Top row: Avatar, Name, National ID, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 text-sm">
                        {s.profile_photo ? (
                          <img src={s.profile_photo} alt={s.full_name} className="w-full h-full object-cover" />
                        ) : (
                          s.full_name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-stone-900 dark:text-white text-sm truncate font-serif">
                          {s.full_name}
                        </h4>
                        <span className="text-[11px] text-stone-500 font-mono block">
                          {s.national_id}
                        </span>
                      </div>
                    </div>

                    {s.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                        <Check className="w-3 h-3" />
                        {t('servant_status_active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shrink-0">
                        {t('servant_status_inactive')}
                      </span>
                    )}
                  </div>

                  {/* Info Row: Service Badge & Phone */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">{s.service_name}</span>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-400">({s.current_role})</span>
                    </div>

                    <a
                      href={`tel:${s.phone}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-mono text-xs transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-stone-500" />
                      <span>{s.phone}</span>
                    </a>

                    <div className="ms-auto inline-flex items-center gap-1 text-[11px] font-bold text-stone-500">
                      <span>نسبة الحضور:</span>
                      <span className={`px-2 py-0.5 rounded-full font-mono ${
                        s.attendance_rate >= 80
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {s.attendance_rate}%
                      </span>
                    </div>
                  </div>

                  {/* Action buttons with generous touch targets */}
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-end gap-1.5">
                    {/* ID Badge QR Card */}
                    <button
                      onClick={() => setIdBadgeServant(s)}
                      className="px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-1 cursor-pointer min-h-[36px]"
                      title="عرض وطباعة كارنيه الخادم مع باركود الحضور"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      <span>كارنيه (QR)</span>
                    </button>

                    <button
                      onClick={() => openViewProfile(s.id)}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-1 cursor-pointer min-h-[36px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>الملف الكامل</span>
                    </button>

                    {s.id_card_photo && hasPermission('view_servant_details') && (
                      <button
                        onClick={() => handleViewIdCard(s.id)}
                        className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[36px]"
                      >
                        <IdCard className="w-3.5 h-3.5" />
                        <span>البطاقة</span>
                      </button>
                    )}

                    {hasPermission('edit_servant') && (
                      <button
                        onClick={() => setTransferringServant(s)}
                        className="px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[36px]"
                        title="توزيع ونقل سنوي للخدمة"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>نقل سنوي</span>
                      </button>
                    )}

                    {hasPermission('edit_servant') && (
                      <button
                        onClick={() => setEditingServant(s)}
                        className="p-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title={t('servant_edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('edit_servant') && (
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`p-2 rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                          s.status === 'active'
                            ? 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                        title={s.status === 'active' ? 'تعطيل / إيقاف مؤقت' : 'تفعيل'}
                      >
                        {s.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}

                    {hasPermission('delete_servant') && (
                      <button
                        onClick={() => setDeletingServant(s)}
                        className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title={t('common_delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800">
                <tr>
                  <th className="py-3 px-4 text-start">{t('servant_name')}</th>
                  <th className="py-3 px-4 text-start">{t('servant_current_service')}</th>
                  <th className="py-3 px-4 text-start">{t('servant_phone')}</th>
                  <th className="py-3 px-4 text-center">{t('portal_attendance_rate')}</th>
                  <th className="py-3 px-4 text-center">{t('servant_status')}</th>
                  <th className="py-3 px-4 text-end">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {servants.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/30 transition-colors">
                    {/* Name & Photo */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 text-xs">
                          {s.profile_photo ? (
                            <img src={s.profile_photo} alt={s.full_name} className="w-full h-full object-cover" />
                          ) : (
                            s.full_name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 dark:text-white text-xs">
                            {s.full_name}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                            {s.national_id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Service & Role */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-stone-800 dark:text-stone-200 block">
                        {s.service_name}
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                        {s.current_role}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4 font-mono text-stone-700 dark:text-stone-300">
                      {s.phone}
                    </td>

                    {/* Attendance % */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold font-mono text-xs ${
                          s.attendance_rate >= 80
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {s.attendance_rate}%
                      </span>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        {s.total_meetings} {language === 'ar' ? 'لقاء' : 'mtgs'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {s.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                          <Check className="w-3 h-3" />
                          {t('servant_status_active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                          {t('servant_status_inactive')}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        {/* View QR ID Badge */}
                        <button
                          onClick={() => setIdBadgeServant(s)}
                          title="عرض وطباعة كارنيه الخادم مع QR كود"
                          className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        {/* View Profile */}
                        <button
                          onClick={() => openViewProfile(s.id)}
                          title={t('servant_view')}
                          className="p-1.5 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* View ID Card */}
                        {s.id_card_photo && hasPermission('view_servant_details') && (
                          <button
                            onClick={() => handleViewIdCard(s.id)}
                            title={t('servant_id_card_view')}
                            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          >
                            <IdCard className="w-4 h-4" />
                          </button>
                        )}

                        {/* Transfer & Annual Service Rotation */}
                        {hasPermission('edit_servant') && (
                          <button
                            onClick={() => setTransferringServant(s)}
                            title="توزيع ونقل سنوي للخدمة وسجل السنوات"
                            className="p-1.5 rounded-lg text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit */}
                        {hasPermission('edit_servant') && (
                          <button
                            onClick={() => setEditingServant(s)}
                            title={t('servant_edit')}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Toggle Status */}
                        {hasPermission('edit_servant') && (
                          <button
                            onClick={() => handleToggleStatus(s)}
                            title={s.status === 'active' ? 'تعطيل / إيقاف مؤقت' : 'تفعيل'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              s.status === 'active'
                                ? 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            {s.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}

                        {/* Delete */}
                        {hasPermission('delete_servant') && (
                          <button
                            onClick={() => setDeletingServant(s)}
                            title={t('common_delete')}
                            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
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
        </div>
        )}
      </div>

      {/* Add Servant Modal */}
      {isAddOpen && (
        <ServantFormModal
          services={services}
          onServiceCreated={fetchServices}
          onClose={() => {
            setIsAddOpen(false);
            if (onClearInitialAdd) onClearInitialAdd();
          }}
          onSuccess={() => {
            setIsAddOpen(false);
            if (onClearInitialAdd) onClearInitialAdd();
            fetchServants();
          }}
          onNeedsAdminAccount={(data) => {
            setAdminAccountTarget(data);
          }}
        />
      )}

      {/* Edit Servant Modal */}
      {editingServant && (
        <ServantFormModal
          servant={editingServant}
          services={services}
          onServiceCreated={fetchServices}
          onClose={() => setEditingServant(null)}
          onSuccess={() => {
            setEditingServant(null);
            fetchServants();
          }}
          onNeedsAdminAccount={(data) => {
            setAdminAccountTarget(data);
          }}
        />
      )}

      {/* Auto Admin Account Creation Modal */}
      {adminAccountTarget && (
        <CreateAdminAccountModal
          isOpen={Boolean(adminAccountTarget)}
          servantData={adminAccountTarget}
          services={services}
          onClose={() => setAdminAccountTarget(null)}
          onSuccess={() => {
            setAdminAccountTarget(null);
            fetchServants();
          }}
        />
      )}

      {/* Quick Add Service Modal from Servants page */}
      {isAddServiceModalOpen && (
        <ServiceFormModal
          onClose={() => setIsAddServiceModalOpen(false)}
          onSuccess={() => {
            setIsAddServiceModalOpen(false);
            fetchServices();
          }}
        />
      )}

      {/* View Profile Drawer / Modal */}
      {viewingServantId && (
        <ServantDetailModal
          data={servantDetails}
          loading={loadingDetails}
          onClose={() => {
            setViewingServantId(null);
            setServantDetails(null);
          }}
          onViewIdCard={handleViewIdCard}
          onOpenBadge={(srv) => {
            const fullServant = servants.find((s) => s.id === srv.id) || srv;
            setIdBadgeServant(fullServant);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingServant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
              {language === 'ar' ? 'تأكيد حذف الخادم' : 'Confirm Servant Deletion'}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
              {language === 'ar'
                ? `هل أنت متأكد من حذف الخادم (${deletingServant.full_name})؟ سيتم حذف جميع تكليفاته وسجلات حضوره بشكل نهائي.`
                : `Are you sure you want to delete (${deletingServant.full_name})? All service assignments and attendance records will be removed.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingServant(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
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

      {/* Protected ID Card Modal */}
      {idCardModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <IdCard className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  {t('servant_id_card_view')} - {idCardModal.name}
                </h3>
              </div>
              <button
                onClick={() => setIdCardModal({ open: false })}
                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 flex items-center justify-center min-h-[220px] max-h-[400px]">
              {idCardModal.photo ? (
                <img
                  src={idCardModal.photo}
                  alt="ID Card"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-stone-500">لا توجد صورة متوفرة</span>
              )}
            </div>

            <div className="mt-3 text-[11px] text-stone-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{t('servant_id_card_restricted')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Servant Transfer & Yearly Service Rotation Modal */}
      {transferringServant && (
        <ServantTransferModal
          isOpen={!!transferringServant}
          servant={transferringServant}
          onClose={() => setTransferringServant(null)}
          onSuccess={() => {
            fetchServants();
          }}
        />
      )}

      {/* Servant ID Badge (QR Code) Modal */}
      {idBadgeServant && (
        <ServantIdCardModal
          isOpen={!!idBadgeServant}
          servant={idBadgeServant}
          serviceName={
            services.find((sv) => sv.id === idBadgeServant.current_service_id)?.name_ar
          }
          onClose={() => setIdBadgeServant(null)}
        />
      )}

      {/* Bulk Print ID Cards Modal */}
      {isBulkPrintBadgesOpen && (
        <BulkPrintIdCardsModal
          isOpen={isBulkPrintBadgesOpen}
          servants={servants}
          services={services}
          onClose={() => setIsBulkPrintBadgesOpen(false)}
        />
      )}
    </div>
  );
};

// Modal for Adding / Editing Servant
interface ServantFormModalProps {
  servant?: any;
  services: ChurchService[];
  onClose: () => void;
  onSuccess: () => void;
  onServiceCreated?: () => void;
  onNeedsAdminAccount?: (data: {
    servantId?: string;
    fullName: string;
    phone: string;
    serviceId: string;
    role: string;
  }) => void;
}

const ServantFormModal: React.FC<ServantFormModalProps> = ({
  servant,
  services,
  onClose,
  onSuccess,
  onServiceCreated,
  onNeedsAdminAccount,
}) => {
  const { t, language } = useLanguage();
  const isEdit = Boolean(servant);

  const [fullName, setFullName] = useState(servant?.full_name || '');
  const [nationalId, setNationalId] = useState(servant?.national_id || '');
  const [phone, setPhone] = useState(servant?.phone || '');
  const [email, setEmail] = useState(servant?.email || '');
  const [dob, setDob] = useState(servant?.date_of_birth || '');
  const [gender, setGender] = useState<'male' | 'female'>(servant?.gender || 'male');
  const [address, setAddress] = useState(servant?.address || '');
  const [serviceId, setServiceId] = useState(servant?.current_service_id || (services[0]?.id || ''));
  const [role, setRole] = useState(servant?.current_role || 'خادم');
  const [joiningDate, setJoiningDate] = useState(servant?.joining_date || new Date().toISOString().split('T')[0]);
  const [serviceStartDate, setServiceStartDate] = useState(
    servant?.service_start_date || new Date().toISOString().split('T')[0]
  );
  const [profilePhoto, setProfilePhoto] = useState(servant?.profile_photo || '');
  const [idCardPhoto, setIdCardPhoto] = useState(servant?.id_card_photo || '');
  const [notes, setNotes] = useState(servant?.notes || '');

  const [isQuickAddServiceOpen, setIsQuickAddServiceOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto calculate Date of Birth and Gender from 14-digit Egyptian National ID
  const handleNationalIdChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 14);
    setNationalId(clean);

    if (clean.length === 14) {
      const c = clean.charAt(0);
      const yy = clean.substring(1, 3);
      const mm = clean.substring(3, 5);
      const dd = clean.substring(5, 7);

      let fullYear = '';
      if (c === '2') fullYear = '19' + yy;
      else if (c === '3') fullYear = '20' + yy;

      const m = parseInt(mm, 10);
      const d = parseInt(dd, 10);

      if (fullYear && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        setDob(`${fullYear}-${mm}-${dd}`);
      }

      // Gender detection from 13th digit (even = female, odd = male)
      const gDigit = parseInt(clean.charAt(12), 10);
      if (!isNaN(gDigit)) {
        const isF = gDigit % 2 === 0;
        const detectedGender = isF ? 'female' : 'male';
        setGender(detectedGender);
        if (detectedGender === 'female' && (role === 'خادم' || !role)) {
          setRole('خادمة');
        } else if (detectedGender === 'male' && (role === 'خادمة' || !role)) {
          setRole('خادم');
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الملف كبير جداً، الحد الأقصى 5 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !nationalId || !phone) {
      setError('الاسم بالكامل، الرقم القومي، ورقم الهاتف حقول مطلوبة');
      return;
    }

    if (nationalId.length < 10 || !/^\d+$/.test(nationalId)) {
      setError('الرقم القومي غير صالح، يجب أن يتكون من أرقام فقط');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      full_name: fullName,
      national_id: nationalId,
      phone,
      email,
      date_of_birth: dob,
      gender,
      address,
      current_service_id: serviceId,
      current_role: role,
      joining_date: joiningDate,
      service_start_date: serviceStartDate,
      profile_photo: profilePhoto || undefined,
      id_card_photo: idCardPhoto || undefined,
      notes,
    };

    try {
      let savedId = servant?.id;
      if (isEdit) {
        await api.put(`/api/servants/${servant.id}`, payload);
      } else {
        const res = await api.post<{ success: boolean; servant?: any }>('/api/servants', payload);
        if (res && res.servant) {
          savedId = res.servant.id;
        }
      }

      // If assigned as Secretary or Assistant, trigger the Admin Account creation flow
      if ((role === 'أمين خدمة' || role === 'مساعد أمين خدمة') && onNeedsAdminAccount) {
        onNeedsAdminAccount({
          servantId: savedId,
          fullName,
          phone,
          serviceId,
          role,
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات الخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 mb-6">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white font-serif">
            {isEdit ? t('servant_edit') : t('servant_add_new')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('servant_name')} *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: يوسف جرجس حنا"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>

            {/* National ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {t('servant_national_id')} (14 رقماً) *
                </label>
                {nationalId.length === 14 && dob && (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
                    ✓ استخراج تلقائي للميلاد
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                maxLength={14}
                value={nationalId}
                onChange={(e) => handleNationalIdChange(e.target.value)}
                placeholder="29801011234567"
                dir="ltr"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
              <p className="text-[10px] text-stone-400 mt-0.5">
                يتم استنتاج تاريخ الميلاد والنوع تلقائياً بمجرد إدخال الـ 14 رقماً.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('servant_phone')} *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                dir="ltr"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('servant_gender')}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              >
                <option value="male">{t('servant_male')}</option>
                <option value="female">{t('servant_female')}</option>
              </select>
            </div>

            {/* Assigned Service with Direct Add option */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {t('servant_current_service')} *
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickAddServiceOpen(true)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ إضافة مرحلة / خدمة جديدة</span>
                </button>
              </div>

              {services.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs flex flex-col gap-2">
                  <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>لا توجد خدمات كنسية مسجلة بعد</span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                    اضغط أدناه لإضافة المرحلة أو الخدمة التي يخدم فيها هذا الخادم (مثل: حضانة، ابتدائي، إعدادي بنين، إعدادي بنات، ثانوي...):
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddServiceOpen(true)}
                    className="self-start px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة الخدمة الآن</span>
                  </button>
                </div>
              ) : (
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                >
                  <option value="">-- اختر المرحلة أو الخدمة الكنسية --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_ar}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Role in service */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                الدور الكنسي في الخدمة *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              >
                <option value="خادم">خادم</option>
                <option value="خادمة">خادمة</option>
                <option value="أمين خدمة">أمين خدمة</option>
                <option value="مساعد أمين خدمة">مساعد أمين خدمة</option>
              </select>
              {(role === 'أمين خدمة' || role === 'مساعد أمين خدمة') && (
                <div className="mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    ⚡ دور إشرافي: سيتم فتح شاشة إنشاء الحساب الإداري فور الحفظ لتمكينه من إدارة المرحلة.
                  </span>
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('servant_dob')}
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>

            {/* Service start date */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('portal_service_start')}
              </label>
              <input
                type="date"
                value={serviceStartDate}
                onChange={(e) => setServiceStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Photos Upload / URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('servant_profile_photo')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setProfilePhoto)}
                  className="text-xs text-stone-500 file:me-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 dark:file:bg-amber-950/40 dark:file:text-amber-300 hover:file:bg-amber-200 cursor-pointer"
                />
                {profilePhoto && (
                  <button
                    type="button"
                    onClick={() => setProfilePhoto('')}
                    className="text-rose-500 text-xs underline"
                  >
                    إزالة
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {t('servant_id_card_photo')} (سرية)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setIdCardPhoto)}
                  className="text-xs text-stone-500 file:me-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-200 file:text-stone-800 dark:file:bg-stone-800 dark:file:text-stone-200 hover:file:bg-stone-300 cursor-pointer"
                />
                {idCardPhoto && (
                  <button
                    type="button"
                    onClick={() => setIdCardPhoto('')}
                    className="text-rose-500 text-xs underline"
                  >
                    إزالة
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              {t('servant_notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات خاصة للآباء أو الإدارة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              {t('common_cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common_loading') : t('common_save')}
            </button>
          </div>
        </form>

        {/* Inline Quick Add Service Modal */}
        {isQuickAddServiceOpen && (
          <ServiceFormModal
            onClose={() => setIsQuickAddServiceOpen(false)}
            onSuccess={(newService) => {
              setIsQuickAddServiceOpen(false);
              if (onServiceCreated) onServiceCreated();
              if (newService?.id) {
                setServiceId(newService.id);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

// Modal for Viewing Full Servant Details
interface ServantDetailModalProps {
  data: any;
  loading: boolean;
  onClose: () => void;
  onViewIdCard: (id: string) => void;
  onOpenBadge?: (servant: any) => void;
}

const ServantDetailModal: React.FC<ServantDetailModalProps> = ({
  data,
  loading,
  onClose,
  onViewIdCard,
  onOpenBadge,
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'attendance' | 'history'>('profile');

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-stone-500">{t('common_loading')}</span>
        </div>
      </div>
    );
  }

  const { servant, attendance_stats, assignments, recent_attendance, has_id_card } = data;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 end-4 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-amber-500 overflow-hidden bg-stone-800 shrink-0 flex items-center justify-center">
              {servant.profile_photo ? (
                <img src={servant.profile_photo} alt={servant.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold">{servant.full_name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif">{servant.full_name}</h2>
              <div className="text-xs text-amber-200/90 mt-0.5">
                {servant.current_service_name} • {servant.current_role}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {language === 'ar' ? 'البيانات الشخصية والكنسية' : 'Personal & Church Info'}
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'attendance'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {language === 'ar' ? 'سجل الحضور والغياب' : 'Attendance'} ({attendance_stats.percentage}%)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {language === 'ar' ? 'التكليفات السابقة' : 'Assignment History'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto text-xs space-y-4">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('servant_national_id')}</span>
                  <span className="font-mono font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block" dir="ltr">
                    {servant.national_id}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('servant_phone')}</span>
                  <span className="font-mono font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block" dir="ltr">
                    {servant.phone}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('servant_dob')}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
                    {servant.date_of_birth || '-'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('servant_gender')}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
                    {servant.gender === 'female' ? t('servant_female') : t('servant_male')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('portal_joining_date')}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
                    {servant.joining_date || '-'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('portal_service_start')}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
                    {servant.service_start_date || '-'}
                  </span>
                </div>
              </div>

              {servant.address && (
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                  <span className="text-stone-400 block">{t('servant_address')}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
                    {servant.address}
                  </span>
                </div>
              )}

              {servant.notes && (
                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30">
                  <span className="text-amber-800 dark:text-amber-300 font-bold block mb-0.5">
                    {t('servant_notes')}
                  </span>
                  <p className="text-stone-700 dark:text-stone-300 leading-relaxed">{servant.notes}</p>
                </div>
              )}

              {/* QR Attendance Badge Card button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={() => onOpenBadge?.(servant)}
                  className="flex-1 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>عرض وطباعة كارنيه الخادم (QR كود)</span>
                </button>

                {has_id_card && (
                  <button
                    onClick={() => onViewIdCard(servant.id)}
                    className="py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-amber-800 dark:text-amber-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IdCard className="w-4 h-4" />
                    <span>بطاقة الرقم القومي</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
                  <span className="text-[10px] text-stone-400 block">{t('portal_total_meetings')}</span>
                  <span className="text-base font-bold font-mono">{attendance_stats.total}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400">
                  <span className="text-[10px] block">{t('portal_present_count')}</span>
                  <span className="text-base font-bold font-mono">{attendance_stats.present}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400">
                  <span className="text-[10px] block">{t('portal_absent_count')}</span>
                  <span className="text-base font-bold font-mono">{attendance_stats.absent}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400">
                  <span className="text-[10px] block">{t('portal_excused_count')}</span>
                  <span className="text-base font-bold font-mono">{attendance_stats.excused}</span>
                </div>
              </div>

              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {recent_attendance.length === 0 ? (
                  <p className="text-stone-400 text-center py-6">لا توجد سجلات حضور مسجلة</p>
                ) : (
                  recent_attendance.map((rec: any) => (
                    <div key={rec.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-500">{rec.date}</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          {rec.service_name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          rec.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : rec.status === 'absent'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {rec.status === 'present' ? 'حاضر' : rec.status === 'absent' ? 'غائب' : 'اعتذار'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {assignments.length === 0 ? (
                <p className="text-stone-400 text-center py-6">لا توجد تكليفات سابقة مسجلة</p>
              ) : (
                assignments.map((a: any) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-stone-800 dark:text-stone-200 block">
                        {a.service_name}
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">
                        {a.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">
                      {a.start_date} {a.end_date ? `← ${a.end_date}` : '(حالية)'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
