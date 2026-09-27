import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Shield, KeyRound, User, ArrowRight, Lock, CheckCircle2, ScanFace, Sparkles, HelpCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { FaceScannerModal } from '../common/FaceScannerModal.js';
import { SuperAdminForgotPasswordModal } from './SuperAdminForgotPasswordModal.js';

interface SuperAdminLoginViewProps {
  onSuccess: () => void;
  onBackToHome: () => void;
}

export const SuperAdminLoginView: React.FC<SuperAdminLoginViewProps> = ({
  onSuccess,
  onBackToHome,
}) => {
  const { login, loginWithToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Face ID state
  const [hasFaceId, setHasFaceId] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const [faceLoginLoading, setFaceLoginLoading] = useState(false);

  // Forgot Password state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  useEffect(() => {
    // Check if Face ID has been enrolled for Super Admin
    api
      .get<{ has_face_id: boolean; admin_name?: string }>('/api/auth/super-admin/face-id/status')
      .then((res) => {
        if (res && res.has_face_id) {
          setHasFaceId(true);
          if (res.admin_name) setAdminName(res.admin_name);
        }
      })
      .catch(() => {
        // Ignore fallback
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى كتابة اسم المستخدم وكلمة المرور');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(username.trim(), password, 'super_admin');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة أو ليس لديك صلاحية مدير المنظومة');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceVerifyComplete = async (vector: number[]) => {
    setFaceLoginLoading(true);
    setError(null);
    try {
      const res = await api.post<{
        success: boolean;
        token: string;
        user: any;
        message: string;
      }>('/api/auth/super-admin/face-id/verify', {
        biometric_vector: vector,
      });

      if (res && res.token && res.user) {
        loginWithToken(res.token, res.user, null);
        setIsFaceScannerOpen(false);
        onSuccess();
      } else {
        throw new Error('فشل تسجيل الدخول ببصمة الوجه');
      }
    } catch (err: any) {
      throw new Error(err.message || 'عذراً، الوجه غير متطابق مع بصمة الوجه المسجلة');
    } finally {
      setFaceLoginLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-stone-900 text-stone-100 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-lg shadow-amber-600/20 mb-3 flex items-center justify-center">
              <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>المدخل الإداري المركزي المباشر</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-amber-100 font-serif">
              لوحة تحكم مدير المنصة
            </h1>
            <p className="text-xs text-stone-400 mt-1 font-medium">
              المنظومة السحابية الموحدة — {adminName || 'م/ أبانوب وجيه'}
            </p>
          </div>

          {/* Optional Face ID Quick-Login Option (Shown only if Face ID is enrolled) */}
          {hasFaceId && (
            <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-amber-500/10 border border-amber-500/40 text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300 font-bold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>بصمة الوجه (Face ID) مفعلة لحسابك</span>
              </div>

              <button
                type="button"
                onClick={() => setIsFaceScannerOpen(true)}
                disabled={faceLoginLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ScanFace className="w-4 h-4 text-stone-950" />
                <span>الدخول السريع ببصمة الوجه (Face ID)</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-stone-800 w-full" />
                <span className="bg-stone-900 px-3 text-[10px] text-stone-400 uppercase tracking-wider absolute">
                  أو ببيانات الدخول
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-600/40 text-rose-200 text-xs flex items-center gap-2 animate-shake">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5 text-right">
                اسم مستخدم المدير العام
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 pl-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-right"
                  required
                />
                <User className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>نسيت كلمة المرور؟</span>
                </button>
                <label className="text-xs font-semibold text-stone-300 text-right">
                  كلمة المرور السرية
                </label>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 pl-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-right font-mono"
                  required
                />
                <KeyRound className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm shadow-lg shadow-amber-600/30 hover:shadow-amber-500/40 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول للوحة المركزية</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick info note */}
          <div className="mt-6 pt-5 border-t border-stone-800/80 flex flex-col items-center gap-2 text-center text-xs text-stone-500">
            <div className="flex items-center gap-1.5 text-stone-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
              <span>إدارة كاملة للكنائس والاشتراكات ومتابعة المدفوعات</span>
            </div>
            <button
              type="button"
              onClick={onBackToHome}
              className="text-stone-400 hover:text-amber-400 text-xs underline cursor-pointer mt-1 transition-colors"
            >
              ← العودة إلى بوابة الكنائس والخدام العامة
            </button>
          </div>
        </div>
      </div>

      {/* Face ID Verification Camera Modal */}
      <FaceScannerModal
        isOpen={isFaceScannerOpen}
        onClose={() => setIsFaceScannerOpen(false)}
        mode="verify"
        onScanComplete={handleFaceVerifyComplete}
        title="تسجيل الدخول ببصمة الوجه (Face ID)"
        subtitle="يرجى النظر للكاميرا لمطابقة ملامح وجهك المسجلة والدخول فوراً"
      />

      {/* Forgot Password Modal */}
      <SuperAdminForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onPasswordResetSuccess={(newU) => {
          if (newU) setUsername(newU);
          setPassword('');
          setError(null);
        }}
      />
    </div>
  );
};
