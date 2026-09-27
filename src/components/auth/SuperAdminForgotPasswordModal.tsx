import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, CheckCircle2, ArrowRight, X, Lock, RefreshCw, AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';

interface SuperAdminForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess: (emailOrUsername?: string) => void;
}

export const SuperAdminForgotPasswordModal: React.FC<SuperAdminForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onPasswordResetSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Cooldown timer for resending code
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        simulated?: boolean;
        verification_code?: string;
      }>(
        '/api/auth/super-admin/forgot-password/request',
        { email: cleanEmail }
      );

      setStep('reset');
      if (res.verification_code) {
        setSimulatedCode(res.verification_code);
        setCode(res.verification_code);
      } else {
        setSimulatedCode(null);
      }
      setSuccessMsg(res.message || `تم إرسال كود التحقق بنجاح إلى بريدك الإلكتروني (${cleanEmail})`);
      setCountdown(60); // 60 seconds cooldown
    } catch (err: any) {
      setError(err.message || 'فشل إرسال كود التحقق. تأكد من صحة البريد الإلكتروني المسجل.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('يرجى إدخال كود التحقق المكون من 6 أرقام المرسل إلى بريدك الإلكتروني');
      return;
    }

    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين، يرجى إعادة التأكد');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        '/api/auth/super-admin/forgot-password/reset',
        {
          email: email.trim().toLowerCase(),
          code: cleanCode,
          new_password: newPassword.trim(),
        }
      );

      setSuccessMsg(res.message || 'تم تعيين كلمة المرور الجديدة بنجاح!');
      setTimeout(() => {
        onPasswordResetSuccess(email.trim().toLowerCase());
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'فشل تعيين كلمة المرور الجديدة. تأكد من صحة الكود وصلاحيته.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-stone-900 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl text-stone-100 overflow-hidden my-auto">
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-100 font-serif">
                استعادة كلمة مرور المدير العام
              </h3>
              <p className="text-xs text-stone-400">
                التحقق الآمن عبر البريد الإلكتروني
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/70 border border-rose-600/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-600/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'request' ? (
          /* Step 1: Enter Email Only */
          <form onSubmit={handleRequestCode} className="space-y-4 mt-5 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5 text-right">
                البريد الإلكتروني المسجل
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 pl-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 text-left font-mono"
                  dir="ltr"
                />
                <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-amber-500/20 text-xs text-stone-300 flex items-start gap-2.5 text-right leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                سيتم إرسال رمز تحقق سري صالح لمدة 15 دقيقة إلى بريدك الإلكتروني المسجل فقط لضمان أمان وحماية النظام.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>إرسال كود التحقق إلى البريد الإلكتروني</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: Enter OTP Code and New Password */
          <form onSubmit={handleResetPassword} className="space-y-4 mt-5 relative z-10">
            {/* Email confirmation pill */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-stone-300 font-mono text-[11px] truncate" dir="ltr">
                  {email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setError(null);
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline shrink-0 mr-2"
              >
                تغيير البريد
              </button>
            </div>

            {simulatedCode && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    كود التحقق المباشر الخاص بك:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCode(simulatedCode);
                      navigator.clipboard?.writeText(simulatedCode);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    نسخ الكود
                  </button>
                </div>
                <div className="text-center font-mono text-2xl font-black tracking-widest text-amber-300 py-1 bg-stone-950/80 rounded-lg border border-amber-500/30">
                  {simulatedCode}
                </div>
                <p className="text-[10px] text-amber-300/80 text-center mt-1.5">
                  تم ملء الكود تلقائياً في الخانة أدناه لتعيين كلمة مرورك فوراً دون أي انتظار.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                كود التحقق السري (6 أرقام)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="------"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.5em] text-amber-400 placeholder-stone-700 focus:outline-hidden focus:border-amber-500"
              />
              <p className="text-[11px] text-stone-400 mt-1 text-right">
                أدخل الكود المكون من 6 أرقام الذي وصلك على البريد الإلكتروني.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 pl-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 text-right font-mono"
                />
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                تأكيد كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 pl-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-500 text-right font-mono"
                />
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                disabled={countdown > 0 || loading}
                onClick={() => handleRequestCode()}
                className="text-stone-400 hover:text-amber-400 disabled:opacity-50 text-[11px] cursor-pointer"
              >
                {countdown > 0 ? `إعادة إرسال الرمز خلال (${countdown}s)` : 'لم يصلك الكود؟ إعادة الإرسال'}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد وتعيين كلمة المرور الجديدة</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors cursor-pointer"
                title="رجوع"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
