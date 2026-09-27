import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { ChurchService } from '../../types/index.js';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  X,
  Check,
  Calendar,
  Sparkles,
  Phone,
  Search,
  UserCheck,
} from 'lucide-react';

const COMMON_CHURCH_SERVICES_PRESETS = [
  { name_ar: 'مرحلة حضانة', code: 'nursery', name_en: 'Nursery Stage' },
  { name_ar: 'أولى وثانية ابتدائي', code: 'pri_1_2', name_en: '1st & 2nd Primary' },
  { name_ar: 'ثالثة ورابعة ابتدائي', code: 'pri_3_4', name_en: '3rd & 4th Primary' },
  { name_ar: 'خامسة وسادسة ابتدائي', code: 'pri_5_6', name_en: '5th & 6th Primary' },
  { name_ar: 'مرحلة إعدادي بنين', code: 'prep_boys', name_en: 'Prep Boys' },
  { name_ar: 'مرحلة إعدادي بنات', code: 'prep_girls', name_en: 'Prep Girls' },
  { name_ar: 'مرحلة ثانوي بنين', code: 'sec_boys', name_en: 'Secondary Boys' },
  { name_ar: 'مرحلة ثانوي بنات', code: 'sec_girls', name_en: 'Secondary Girls' },
  { name_ar: 'خدمة إعداد خدام', code: 'servants_prep', name_en: 'Servants Preparation' },
  { name_ar: 'اجتماع الخدام العام', code: 'servants_general', name_en: 'General Servants Meeting' },
  { name_ar: 'اجتماع أبونا يسطس للرجال', code: 'men_meeting', name_en: 'Abouna Yostos Men Meeting' },
  { name_ar: 'اجتماع السيدات', code: 'ladies_meeting', name_en: 'Ladies Meeting' },
  { name_ar: 'اجتماع الحكماء', code: 'elders_meeting', name_en: 'Elders Meeting' },
  { name_ar: 'مدرسة الشمامسة والألحان', code: 'deacons_choir', name_en: 'Deacons & Hymns' },
  { name_ar: 'الكشافة والمرشدات', code: 'scouts', name_en: 'Scouts & Guides' },
];

export const ServicesList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { t, language } = useLanguage();

  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingService, setEditingService] = useState<ChurchService | null>(null);
  const [deletingService, setDeletingService] = useState<any | null>(null);
  const [selectedServiceForServants, setSelectedServiceForServants] = useState<any | null>(null);
  const [serviceServants, setServiceServants] = useState<any[]>([]);
  const [loadingServants, setLoadingServants] = useState(false);
  const [servantsSearch, setServantsSearch] = useState('');

  useEffect(() => {
    if (!selectedServiceForServants) {
      setServiceServants([]);
      return;
    }
    const loadServants = async () => {
      setLoadingServants(true);
      try {
        const res = await api.get<{ success: boolean; servants: any[] }>(
          `/api/servants?service_id=${selectedServiceForServants.id}`
        );
        setServiceServants(res.servants || []);
      } catch {
        setServiceServants([]);
      } finally {
        setLoadingServants(false);
      }
    };
    loadServants();
  }, [selectedServiceForServants]);

  const filteredServants = serviceServants.filter((s) => {
    if (!servantsSearch.trim()) return true;
    const term = servantsSearch.toLowerCase().trim();
    return (
      (s.full_name || '').toLowerCase().includes(term) ||
      (s.phone || '').includes(term) ||
      (s.current_role || '').toLowerCase().includes(term)
    );
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; services: any[] }>('/api/services');
      setServices(res.services);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب الخدمات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleDelete = async () => {
    if (!deletingService) return;
    try {
      await api.delete(`/api/services/${deletingService.id}`);
      setDeletingService(null);
      fetchServices();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف الخدمة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            {t('nav_services')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {language === 'ar'
              ? 'إدارة مراحل وأسر وخدمات الكنيسة (حضانة، ابتدائي، إعدادي، ثانوي، اجتماعات عامة)'
              : 'Manage church service stages, departments, and activities'}
          </p>
        </div>

        {hasPermission('add_service') && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة مرحلة / خدمة جديدة' : 'Add New Service'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Services */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-stone-500">{t('common_loading')}</span>
        </div>
      ) : services.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white mb-1.5 font-serif">
            لم تقم بإضافة أي خدمات كنسية بعد
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto mb-6 leading-relaxed">
            ابدأ الآن بإضافة مراحل وخدمات الكنيسة بحسب رغبتك (مثل: مرحلة حضانة، ابتدائي، إعدادي بنين وبنات، ثانوي، إعداد خدام، اجتماعات الكبار...) لتتمكن من إسناد الخدام إليها لاحقاً.
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة أول خدمة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-stone-900 dark:text-white font-serif truncate">
                        {srv.name_ar}
                      </h3>
                      <span className="text-[11px] font-mono text-stone-400 block truncate" dir="ltr">
                        {srv.code}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      srv.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {srv.status === 'active' ? 'نشطة' : 'معطلة'}
                  </span>
                </div>

                {srv.description && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mb-3 line-clamp-2 leading-relaxed">
                    {srv.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedServiceForServants(srv);
                    setServantsSearch('');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 -mx-1.5 rounded-xl text-stone-700 dark:text-stone-300 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-transparent hover:border-amber-200 dark:hover:border-amber-800/60 transition-all group cursor-pointer"
                  title={language === 'ar' ? 'اضغط لعرض الخدام المسجلين في هذه المرحلة' : 'Click to view registered servants in this stage'}
                >
                  <Users className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="font-bold underline decoration-dotted decoration-amber-400/80 underline-offset-4 group-hover:decoration-solid">
                    {srv.servants_count} {language === 'ar' ? 'خادم مسجل' : 'servants'}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  {hasPermission('edit_service') && (
                    <button
                      onClick={() => setEditingService(srv)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      title={t('common_edit')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {hasPermission('delete_service') && (
                    <button
                      onClick={() => setDeletingService(srv)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title={t('common_delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddOpen || editingService) && (
        <ServiceFormModal
          service={editingService}
          existingServices={services}
          onClose={() => {
            setIsAddOpen(false);
            setEditingService(null);
          }}
          onSuccess={() => {
            setIsAddOpen(false);
            setEditingService(null);
            fetchServices();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingService && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
              {language === 'ar' ? 'تأكيد حذف الخدمة' : 'Confirm Service Deletion'}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
              {language === 'ar'
                ? `هل أنت متأكد من حذف خدمة (${deletingService.name_ar})؟ لن يمكنك الحذف إذا كان هناك خدام مسندون إليها بالفعل.`
                : `Are you sure you want to delete (${deletingService.name_ar})? You cannot delete a service that currently has active servants.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingService(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                {t('common_cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                {t('common_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Servants of Service Modal */}
      {selectedServiceForServants && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-xl w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
                    {language === 'ar' ? 'الخدام المسجلون في الخدمة' : 'Registered Servants'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {selectedServiceForServants.name_ar}
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono" dir="ltr">
                      ({selectedServiceForServants.code})
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedServiceForServants(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Count Bar */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={servantsSearch}
                  onChange={(e) => setServantsSearch(e.target.value)}
                  placeholder={language === 'ar' ? 'بحث بالاسم، رقم الهاتف أو الصفة...' : 'Search by name, phone...'}
                  className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                />
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold shrink-0 border border-amber-200 dark:border-amber-800/40">
                {serviceServants.length} {language === 'ar' ? 'خادم مسجل' : 'servants'}
              </span>
            </div>

            {/* Body / List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[160px] pr-1">
              {loadingServants ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs text-stone-500 font-semibold">{t('common_loading')}</span>
                </div>
              ) : serviceServants.length === 0 ? (
                <div className="py-12 text-center text-stone-500">
                  <Users className="w-10 h-10 mx-auto mb-2 text-stone-300 dark:text-stone-700" />
                  <p className="text-xs font-semibold">
                    {language === 'ar'
                      ? 'لا يوجد خدام مسندون إلى هذه الخدمة حالياً'
                      : 'No servants currently assigned to this service'}
                  </p>
                </div>
              ) : filteredServants.length === 0 ? (
                <div className="py-8 text-center text-stone-500">
                  <p className="text-xs">
                    {language === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching servants found'}
                  </p>
                </div>
              ) : (
                filteredServants.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 hover:bg-stone-100/60 dark:hover:bg-stone-800/80 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {srv.full_name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('') || 'خ'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate">
                            {srv.full_name}
                          </h4>
                          {srv.deacon_rank && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                              {srv.deacon_rank}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          <span className="font-semibold text-stone-700 dark:text-stone-300">
                            {srv.current_role || (language === 'ar' ? 'خادم' : 'Servant')}
                          </span>
                          {srv.phone && (
                            <span dir="ltr" className="font-mono text-stone-400">
                              • {srv.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {srv.phone && (
                        <a
                          href={`tel:${srv.phone}`}
                          className="p-2 rounded-xl text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                          title="اتصال هاتفياً"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          srv.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {srv.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'معطل' : 'Inactive')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedServiceForServants(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              >
                {t('common_close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: Service Form Modal (Exported for reuse)
export interface ServiceFormModalProps {
  service?: any;
  existingServices?: any[];
  onClose: () => void;
  onSuccess: (createdService?: any) => void;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  service,
  existingServices = [],
  onClose,
  onSuccess,
}) => {
  const { t, language } = useLanguage();
  const isEdit = Boolean(service);

  const [nameAr, setNameAr] = useState(service?.name_ar || '');
  const [nameEn, setNameEn] = useState(service?.name_en || '');
  const [code, setCode] = useState(service?.code || '');
  const [description, setDescription] = useState(service?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyPreset = (preset: { name_ar: string; code: string; name_en: string }) => {
    setNameAr(preset.name_ar);
    setCode(preset.code);
    setNameEn(preset.name_en);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr || !code) {
      setError('اسم الخدمة بالعربية وكود الخدمة حقول مطلوبة');
      return;
    }

    const norm = (str: string) =>
      str
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ');

    const targetNorm = norm(nameAr);
    const targetCode = code.trim().toUpperCase();

    if (existingServices && existingServices.length > 0) {
      const duplicate = existingServices.find(
        (s) =>
          (!isEdit || s.id !== service?.id) &&
          (norm(s.name_ar || '') === targetNorm ||
            (targetCode && targetCode !== 'SRV' && s.code?.trim().toUpperCase() === targetCode))
      );

      if (duplicate) {
        setError(
          language === 'ar'
            ? `هذه المرحلة أو الخدمة مسجلة بالفعل في الكنيسة (${duplicate.name_ar})، لا يمكن تكرار نفس المرحلة.`
            : `This service stage already exists in the church (${duplicate.name_ar}).`
        );
        return;
      }
    }

    setLoading(true);
    setError(null);

    const payload = {
      name_ar: nameAr.trim(),
      name_en: nameEn.trim() || undefined,
      code: code.trim().toLowerCase(),
      description: description.trim() || undefined,
    };

    try {
      let result;
      if (isEdit) {
        result = await api.put<{ success: boolean; service: any }>(`/api/services/${service.id}`, payload);
      } else {
        result = await api.post<{ success: boolean; service: any }>('/api/services', payload);
      }
      onSuccess(result.service);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الخدمة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-5 sm:p-7 border border-stone-200 dark:border-stone-800 shadow-2xl my-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-white font-serif">
            {isEdit
              ? language === 'ar'
                ? 'تعديل الخدمة'
                : 'Edit Service'
              : language === 'ar'
              ? 'إضافة مرحلة / خدمة كنسية جديدة'
              : 'Add New Church Service'}
          </h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Quick Presets selector for quick input */}
        {!isEdit && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-400 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>اقتراحات سريعة للمراحل الكنسية (انقر للتعبئة التلقائية):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
              {COMMON_CHURCH_SERVICES_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.code}
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 border border-amber-300/80 dark:border-amber-800/80 hover:bg-amber-600 hover:text-white text-[10px] font-semibold text-stone-800 dark:text-stone-200 transition-colors cursor-pointer"
                >
                  {p.name_ar}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              اسم الخدمة أو المرحلة (بالعربية) *
            </label>
            <input
              type="text"
              required
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: مرحلة حضانة / إعدادي بنين / اجتماع الحكماء..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              كود الخدمة الفريد (Code بالإنجليزية) *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="nursery, prep_boys, pri_1_2..."
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              الاسم الإنجليزي (اختياري)
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Nursery, Prep Boys..."
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              الوصف أو الملاحظات ومواعيد اللقاء
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل عن الفئة المستهدفة أو مواعيد الاجتماع الأسبوعي..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs cursor-pointer min-h-[38px]"
            >
              {loading ? t('common_loading') : t('common_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
