import React, { useState } from 'react';
import { UserPlus, X, Shield, Lock, Eye, EyeOff, Check, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { ChurchService } from '../../types/index.js';

interface CreateAdminAccountModalProps {
  isOpen: boolean;
  servantData: {
    servantId?: string;
    fullName: string;
    phone: string;
    serviceId: string;
    role: string; // 'أمين خدمة' or 'مساعد أمين خدمة'
  } | null;
  services: ChurchService[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateAdminAccountModal: React.FC<CreateAdminAccountModalProps> = ({
  isOpen,
  servantData,
  services,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !servantData) return null;

  const targetService = services.find((s) => s.id === servantData.serviceId);
  const serviceName = targetService ? targetService.name_ar : 'المرحلة المسندة';

  // Generate initial suggested username from phone
  const initialUsername = `sec_${servantData.phone.slice(-4) || 'user'}`;

  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('StGeorge@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let randomPass = 'SG@';
    for (let i = 0; i < 6; i++) {
      randomPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(randomPass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى كتابة اسم المستخدم وكلمة السر');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Default permissions for Stage Coordinator / Secretary
      const permissions = [
        'view_servants',
        'view_servant_details',
        'view_attendance',
        'add_attendance',
        'edit_attendance',
        'view_reports',
        'export_reports',
        'manage_scanner',
      ];

      const payload = {
        username: username.trim(),
        password: password.trim(),
        name: servantData.fullName,
        role: servantData.role === 'أمين خدمة' ? 'captain' : 'stage_coordinator',
        church_role_title: servantData.role,
        scope: servantData.serviceId,
        permissions,
        linked_servant_id: servantData.servantId,
        status: 'active',
      };

      const res = await api.post<{ success: boolean; user?: any; message?: string }>('/api/users', payload);

      if (res && (res.success || res.user)) {
        setSuccessMsg(`تم إنشاء الحساب الإداري بنجاح باسم المستخدم (${username.trim()})`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
      } else {
        throw new Error(res?.message || 'فشل إنشاء الحساب');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الحساب';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-stone-200 dark:border-stone-800 shadow-2xl relative my-auto animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white font-serif">
                إنشاء حساب إداري لأمين الخدمة
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                لتمكين الخادم من إدارة مرحلته وتسجيل الحضور والانصراف
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pre-filled Notice Banner */}
        <div className="p-3.5 mb-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>بيانات الخادم المسند إليه الدور القيادي:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-medium text-stone-700 dark:text-stone-300">
            <div>الاسم: <strong className="text-stone-900 dark:text-white">{servantData.fullName}</strong></div>
            <div>المسمى: <strong className="text-amber-700 dark:text-amber-400">{servantData.role}</strong></div>
            <div>الهاتف: <span className="font-mono">{servantData.phone}</span></div>
            <div>المرحلة: <strong className="text-stone-900 dark:text-white">{serviceName}</strong></div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              اسم المستخدم لتسجيل الدخول (Username) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="مثال: george_sec"
              dir="ltr"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              يُفضل استخدام أحرف إنجليزية وأرقام بدون مسافات.
            </p>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                كلمة المرور المؤقتة (Password) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-amber-700 dark:text-amber-400 font-bold hover:underline"
              >
                توليد كلمة سر عشوائية
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Scope and Permissions Info */}
          <div className="p-3 bg-stone-100/70 dark:bg-stone-800/60 rounded-xl text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
            <div className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>الصلاحيات التلقائية للحساب:</span>
            </div>
            <p>
              • نطاق التحكم محدد لخدمة: <strong>{serviceName}</strong> فقط.
            </p>
            <p>
              • الصلاحيات: عرض خدام المرحلة، تسجيل الحضور والانصراف، واستخراج التقارير.
            </p>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
            >
              إنشاء لاحقاً
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? 'جاري الإنشاء...' : 'إنشاء وتفعيل الحساب الآن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
