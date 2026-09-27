import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Church } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { LogoUploader } from '../common/LogoUploader.js';
import {
  Settings,
  Building2,
  Image,
  Palette,
  Phone,
  MapPin,
  Mail,
  Share2,
  CheckCircle2,
  AlertCircle,
  X,
  Cross,
} from 'lucide-react';

export const ChurchSettings: React.FC = () => {
  const { church, setChurch, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Helper to extract values from church object
  const extractChurchData = (c: Church | null) => {
    if (!c) return null;
    return {
      name: c.name || '',
      diocese: c.diocese || '',
      bishop_name: c.bishop_name || '',
      phone: c.phone || '',
      address: c.address || '',
      email: c.email || '',
      logo_url: c.logo_url || c.branding?.logo_url || '',
      primary_color: c.branding?.primary_color || '#b45309',
      secondary_color: c.branding?.secondary_color || '#78350f',
      facebook_url: c.social_links?.facebook || c.branding?.social_links?.facebook || '',
      youtube_url: c.social_links?.youtube || c.branding?.social_links?.youtube || '',
      instagram_url: c.social_links?.instagram || c.branding?.social_links?.instagram || '',
    };
  };

  const [formData, setFormData] = useState(() => {
    return (
      extractChurchData(church) || {
        name: '',
        diocese: '',
        bishop_name: '',
        phone: '',
        address: '',
        email: '',
        logo_url: '',
        primary_color: '#b45309',
        secondary_color: '#78350f',
        facebook_url: '',
        youtube_url: '',
        instagram_url: '',
      }
    );
  });

  useEffect(() => {
    const fetchCurrentChurch = async () => {
      setLoading(true);
      try {
        const res = await api.get<{ success: boolean; church: Church }>('/api/tenant/settings');
        if (res.church) {
          setChurch(res.church);
          const data = extractChurchData(res.church);
          if (data) {
            setFormData(data);
          }
        } else if (church) {
          const fallbackData = extractChurchData(church);
          if (fallbackData) setFormData(fallbackData);
        }
      } catch (err: any) {
        console.error('Failed to load church settings', err);
        if (church) {
          const fallbackData = extractChurchData(church);
          if (fallbackData) setFormData(fallbackData);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentChurch();
  }, [setChurch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setMessage({ type: 'error', text: 'اسم الكنيسة حقل إلزامي' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: formData.name,
        diocese: formData.diocese,
        bishop_name: formData.bishop_name,
        phone: formData.phone,
        address: formData.address,
        email: formData.email,
        logo_url: formData.logo_url,
        social_links: {
          facebook: formData.facebook_url,
          youtube: formData.youtube_url,
          instagram: formData.instagram_url,
        },
        branding: {
          logo_url: formData.logo_url,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          social_links: {
            facebook: formData.facebook_url,
            youtube: formData.youtube_url,
            instagram: formData.instagram_url,
          },
        },
      };

      const res = await api.put<{ success: boolean; church: Church }>('/api/tenant/settings', payload);
      if (res.church) {
        setChurch(res.church);
        const updatedData = extractChurchData(res.church);
        if (updatedData) {
          setFormData(updatedData);
        }
      }
      setMessage({ type: 'success', text: 'تم حفظ إعدادات وهوية الكنيسة بنجاح' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ الإعدادات' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-stone-400">
        <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">جاري تحميل بيانات الكنيسة...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
            <Settings className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">تخصيص وهوية الكنيسة</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-white font-serif">
            إعدادات وهوية الكنيسة
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            تخصيص اسم الكنيسة، الشعار واللوجو، وسائل الاتصال والإيبارشية بما يظهر للخدام والزوار على النظام.
          </p>
        </div>

        {/* Live Preview Emblem */}
        <div className="flex items-center gap-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-600 shadow-xs shrink-0 flex items-center justify-center bg-stone-100 dark:bg-stone-800">
            {formData.logo_url ? (
              <img
                src={formData.logo_url}
                alt="Logo preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Cross className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-stone-900 dark:text-white font-serif max-w-[160px] truncate">
              {formData.name || 'اسم الكنيسة'}
            </p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold truncate max-w-[160px]">
              {formData.diocese ? `إيبارشية ${formData.diocese}` : 'منظومة إدارة الخدمة'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
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
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-stone-900 dark:text-white pb-2 border-b border-stone-200 dark:border-stone-800">
            <Building2 className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold">البيانات الأساسية والإيبارشية</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                اسم الكنيسة الرسمي *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                اسم الإيبارشية
              </label>
              <input
                type="text"
                value={formData.diocese}
                onChange={(e) => setFormData({ ...formData, diocese: e.target.value })}
                placeholder="مثال: شبين القناطر وتوابعها"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                اسم الأب الأسقف / المطران (راعى الإيبارشية)
              </label>
              <input
                type="text"
                value={formData.bishop_name}
                onChange={(e) => setFormData({ ...formData, bishop_name: e.target.value })}
                placeholder="مثال: نيافة الأنبا نوفير أو نيافة الأنبا مكسيموس"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
              <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 block">
                يُضاف تلقائيًا في برقيات المعايدة ورسائل واتساب لأعياد ميلاد الخدام التابعة لكنيستكم
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-stone-500" />
                <span>رقم الهاتف</span>
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-stone-500" />
                <span>العنوان / المنطقة</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-stone-500" />
                <span>البريد الإلكتروني</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Branding & Logo */}
        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-stone-900 dark:text-white pb-2 border-b border-stone-200 dark:border-stone-800">
            <Image className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold">الهوية البصرية والشعار</h3>
          </div>

          <div>
            <LogoUploader
              value={formData.logo_url}
              onChange={(url) => setFormData({ ...formData, logo_url: url })}
              label="شعار / لوجو الكنيسة"
              hint="اختر صورة الشعار الرسمية لكنيستك من جهازك أو اسحبها هنا"
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-stone-900 dark:text-white pb-2 border-b border-stone-200 dark:border-stone-800">
            <Share2 className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold">روابط التواصل والصفحات</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                صفحة فيسبوك
              </label>
              <input
                type="text"
                placeholder="https://facebook.com/..."
                value={formData.facebook_url}
                onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                قناة يوتيوب
              </label>
              <input
                type="text"
                placeholder="https://youtube.com/..."
                value={formData.youtube_url}
                onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                حساب إنستجرام
              </label>
              <input
                type="text"
                placeholder="https://instagram.com/..."
                value={formData.instagram_url}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-all"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  );
};
