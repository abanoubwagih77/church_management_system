import React, { useState, useEffect } from 'react';
import {
  Users,
  KeyRound,
  CheckCircle2,
  Copy,
  Printer,
  X,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { ChurchService } from '../../types/index.js';

interface GeneratedAccount {
  servant_id: string;
  servant_name: string;
  service_name: string;
  username: string;
  initial_password: string;
  phone: string;
}

interface BulkUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkUsersModal: React.FC<BulkUsersModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [services, setServices] = useState<ChurchService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [passwordType, setPasswordType] = useState<'random' | 'phone' | 'custom'>('random');
  const [customPassword, setCustomPassword] = useState<string>('church1234');
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedList, setGeneratedList] = useState<GeneratedAccount[]>([]);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchServices();
      setGeneratedList([]);
      setError('');
    }
  }, [isOpen]);

  const fetchServices = async () => {
    try {
      const res = await api.get<{ services: ChurchService[] }>('/api/services');
      if (res.services) {
        setServices(res.services);
      }
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        created_count: number;
        users: GeneratedAccount[];
      }>('/api/users/bulk-generate', {
        service_id: selectedServiceId,
        default_password_type: passwordType,
        custom_password: customPassword,
      });

      if (res.created_count === 0) {
        setError(res.message || 'جميع الخدام في هذه الخدمة لديهم حسابات مستخدمين بالفعل');
      } else {
        setGeneratedList(res.users);
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل توليد الحسابات';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (generatedList.length === 0) return;
    const text = generatedList
      .map(
        (u, i) =>
          `${i + 1}. الخادم: ${u.servant_name} | الخدمة: ${u.service_name} | اسم المستخدم: ${u.username} | كلمة المرور المؤقتة: ${u.initial_password}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base font-serif">
                توليد حسابات للخدام دفعة واحدة
              </h3>
              <p className="text-xs text-stone-500">
                إنشاء أسماء مستخدمين وكلمات مرور مؤقتة لجميع الخدام غير المسجلين
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {generatedList.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 rounded-xl p-4 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <p className="font-bold text-stone-900 dark:text-stone-100 mb-1">
                  ✨ مميزات التوليد التلقائي:
                </p>
                - يبحث النظام عن الخدام الذين ليس لديهم حساب مستخدم إداري.<br />
                - يتم ربط كل حساب تلقائياً بسجل الخادم ومرحلته الحالية.<br />
                - يتم إجبار الخادم على <strong>تغيير كلمة المرور الشخصية</strong> عند أول تسجيل دخول لضمان الخصوصية.<br />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  المرحلة / الخدمة المراد إنشاء حسابات لخدامها:
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                >
                  <option value="all">جميع المراحل والخدمات (الخدام المتاحين)</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  طريقة تعيين كلمة المرور الأولية المؤقتة:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="p-3 border rounded-xl flex flex-col gap-1 cursor-pointer bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700">
                    <input
                      type="radio"
                      name="pwd_type"
                      checked={passwordType === 'random'}
                      onChange={() => setPasswordType('random')}
                      className="accent-amber-600"
                    />
                    <span className="font-bold mt-1">6 أرقام عشوائية</span>
                    <span className="text-[10px] text-stone-400">مثال: 482910</span>
                  </label>
                  <label className="p-3 border rounded-xl flex flex-col gap-1 cursor-pointer bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700">
                    <input
                      type="radio"
                      name="pwd_type"
                      checked={passwordType === 'phone'}
                      onChange={() => setPasswordType('phone')}
                      className="accent-amber-600"
                    />
                    <span className="font-bold mt-1">آخر 6 أرقام من الهاتف</span>
                    <span className="text-[10px] text-stone-400">سهل التذكر للخادم</span>
                  </label>
                  <label className="p-3 border rounded-xl flex flex-col gap-1 cursor-pointer bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700">
                    <input
                      type="radio"
                      name="pwd_type"
                      checked={passwordType === 'custom'}
                      onChange={() => setPasswordType('custom')}
                      className="accent-amber-600"
                    />
                    <span className="font-bold mt-1">كلمة مرور موحدة</span>
                    <span className="text-[10px] text-stone-400">تحددها أنت للكل</span>
                  </label>
                </div>
              </div>

              {passwordType === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    كلمة المرور الموحدة المؤقتة:
                  </label>
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold">
                    تم إنشاء {generatedList.length} حساب بنجاح!
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="px-3 py-1 bg-white dark:bg-stone-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'تم النسخ' : 'نسخ القائمة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة الكشوفات</span>
                  </button>
                </div>
              </div>

              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">الخادم</th>
                      <th className="p-2.5">الخدمة</th>
                      <th className="p-2.5">اسم المستخدم</th>
                      <th className="p-2.5">كلمة المرور المؤقتة</th>
                      <th className="p-2.5">الموبايل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {generatedList.map((u) => (
                      <tr key={u.servant_id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                        <td className="p-2.5 font-bold">{u.servant_name}</td>
                        <td className="p-2.5 text-stone-500">{u.service_name}</td>
                        <td className="p-2.5 font-mono font-semibold text-amber-700 dark:text-amber-400 select-all">
                          {u.username}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 select-all">
                          {u.initial_password}
                        </td>
                        <td className="p-2.5 text-stone-400">{u.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 dark:text-stone-300 transition-colors"
          >
            {generatedList.length > 0 ? 'إغلاق' : 'إلغاء'}
          </button>
          {generatedList.length === 0 && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التوليد...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>بدء إنشاء الحسابات الآن</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
