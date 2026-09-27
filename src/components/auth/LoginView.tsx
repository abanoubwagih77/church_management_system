import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import {
  Lock,
  User,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Cross,
  Home,
  Building2,
} from 'lucide-react';

interface LoginViewProps {
  onSuccess: () => void;
  onOpenPortal: () => void;
  onBackToHome?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onSuccess,
  onOpenPortal,
  onBackToHome,
}) => {
  const { login, church } = useAuth();
  const { isRtl } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Authenticate strictly against the Church portal
      await login(username.trim(), password, 'church');
      onSuccess();
    } catch (err: any) {
      setError(
        err.message ||
          'لا توجد كنيسة مسجلة بهذا الحساب، أو بيانات الدخول غير صحيحة.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 dark:border-stone-800 relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700" />

        {/* Church Logo & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex p-2.5 rounded-2xl bg-amber-950/5 dark:bg-amber-400/10 border border-amber-300/60 dark:border-amber-700/30 mb-3 shadow-xs">
            {church?.logo_url ? (
              <img
                src={church.logo_url}
                alt={church.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-600 shadow-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-500 flex items-center justify-center text-white shadow-md">
                <Cross className="w-8 h-8" />
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white font-serif">
            {church?.name || 'تسجيل دخول الكنيسة'}
          </h2>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-semibold">
            {church?.diocese || 'مخصص للآباء الكهنة وأمناء الخدمة والخدام المسجلين'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              اسم المستخدم
            </label>
            <div className="relative">
              <input
                id="input-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
              <User className="w-4 h-4 text-stone-400 absolute end-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="input-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
              <Lock className="w-4 h-4 text-stone-400 absolute end-3 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-amber-700 hover:bg-amber-800 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Building2 className="w-4 h-4" />
                <span>دخول الكنيسة</span>
              </>
            )}
          </button>
        </form>

        {/* Secondary Links: Servant Portal & Back to Home */}
        <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-col gap-2.5 text-center">
          <button
            id="btn-login-to-portal"
            type="button"
            onClick={onOpenPortal}
            className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>بوابة الاستعلام بالرقم القومي للخدام (بدون كلمة سر)</span>
            {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>

          {onBackToHome && (
            <button
              id="btn-login-back-to-home"
              type="button"
              onClick={onBackToHome}
              className="text-xs font-semibold text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>الرجوع للصفحة الرئيسية</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
