import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  DollarSign,
  Info,
  Phone,
  PhoneCall,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';

export const SubscriptionRenewalBanner: React.FC = () => {
  const { church, user, isSuperAdmin, setChurch } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  if (isSuperAdmin || !church || !church.subscription || isDismissed) {
    return null;
  }

  const { subscription } = church;
  const renewalNotice = subscription.renewal_notice;
  const isNoticeActive = renewalNotice && !renewalNotice.acknowledged;

  // Calculate days remaining until next_due_date
  let daysRemaining: number | null = null;
  let isOverdue = subscription.payment_status === 'overdue';
  let isDueSoon = false;

  if (subscription.next_due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(subscription.next_due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      isOverdue = true;
    } else if (daysRemaining <= 14) {
      isDueSoon = true;
    }
  }

  // If status is already paid and no active notice and renewal is more than 14 days away, don't show
  if (!isNoticeActive && !isOverdue && !isDueSoon && subscription.payment_status === 'paid') {
    return null;
  }

  const handleAcknowledgeNotice = async () => {
    setIsAcknowledging(true);
    try {
      await api.post('/api/tenant/acknowledge-renewal-notice', {});
      if (church.subscription?.renewal_notice) {
        setChurch({
          ...church,
          subscription: {
            ...church.subscription,
            renewal_notice: {
              ...church.subscription.renewal_notice,
              acknowledged: true,
            },
          },
        });
      }
    } catch (err) {
      console.error('Failed to acknowledge renewal notice:', err);
    } finally {
      setIsAcknowledging(false);
    }
  };

  // Determine banner theme and content
  let bannerBg = 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200';
  let bannerIcon = <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;
  let bannerTitle = 'تذكير بموعد تجديد اشتراك الكنيسة';
  let bannerText = '';

  if (isNoticeActive) {
    bannerBg = 'bg-purple-500/10 border-purple-500/30 text-purple-900 dark:text-purple-200';
    bannerIcon = <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 animate-bounce" />;
    bannerTitle = `إشعار من الإدارة المركزية (${renewalNotice.sent_by_name})`;
    bannerText = renewalNotice.message;
  } else if (isOverdue) {
    bannerBg = 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200';
    bannerIcon = <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />;
    bannerTitle = 'تنبيه: اشتراك الكنيسة متأخر عن موعد السداد';
    bannerText = `انتهى موعد استحقاق الاشتراك بتاريخ (${subscription.next_due_date || 'سابقاً'}). قيمة الاشتراك: ${subscription.fee ?? 500} ج.م. يرجى التنسيق مع م/ أبانوب وجيه عبر قنوات التواصل المعتمدة أو الاتصال به على رقم 01012348828 للسداد.`;
  } else if (isDueSoon) {
    bannerBg = 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200';
    bannerIcon = <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;
    bannerTitle = 'تذكير: اقتراب موعد تجديد اشتراك الكنيسة';
    bannerText = `يستحق موعد تجديد الاشتراك خلال (${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}) بتاريخ (${subscription.next_due_date}). قيمة التجديد: ${subscription.fee ?? 500} ج.م. للتنسيق: الاتصال على رقم 01012348828 (م/ أبانوب وجيه).`;
  } else if (subscription.payment_status === 'unpaid') {
    bannerBg = 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200';
    bannerIcon = <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />;
    bannerTitle = 'إشعار: مطلوب سداد رسوم اشتراك المنظومة';
    bannerText = `يرجى تأكيد وسداد رسوم الاشتراك المقررة (${subscription.fee ?? 500} ج.م) بالتواصل مع مسؤول الإدارة المركزية (م/ أبانوب وجيه) عبر قنوات التواصل المعتمدة أو الاتصال به على رقم 01012348828.`;
  }

  return (
    <>
      <div
        className={`mb-4 p-3.5 sm:p-4 rounded-2xl border ${bannerBg} shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-200`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {bannerIcon}
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>{bannerTitle}</span>
              {subscription.plan && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-sans uppercase font-bold bg-white/70 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                  {subscription.plan}
                </span>
              )}
            </h4>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">
              {bannerText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {isNoticeActive && (
            <button
              onClick={handleAcknowledgeNotice}
              disabled={isAcknowledging}
              className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم الاستلام</span>
            </button>
          )}

          <button
            onClick={() => setShowDetailsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-stone-800/80 hover:bg-white dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold border border-stone-300 dark:border-stone-700 shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>تفاصيل الاشتراك</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="إخفاء التنبيه مؤقتاً"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subscription Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-5 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white font-serif">
                    بيانات اشتراك الكنيسة
                  </h3>
                  <p className="text-[11px] text-stone-500">{church.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500">الباقة الحالية:</span>
                <span className="font-bold text-stone-900 dark:text-white uppercase">
                  {subscription.plan}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500">رسوم الاشتراك السنوية:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {subscription.fee ?? 500} ج.م
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500">حالة السداد:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                    subscription.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : subscription.payment_status === 'overdue'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {subscription.payment_status === 'paid'
                    ? 'مسدد'
                    : subscription.payment_status === 'overdue'
                    ? 'متأخر عن السداد'
                    : 'في انتظار السداد'}
                </span>
              </div>

              {subscription.next_due_date && (
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500">تاريخ التجديد القادم:</span>
                  <span className="font-bold text-stone-900 dark:text-white">
                    {subscription.next_due_date}
                  </span>
                </div>
              )}

              {subscription.last_payment_date && (
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500">تاريخ آخر سداد:</span>
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    {new Date(subscription.last_payment_date).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-xs text-amber-950 dark:text-amber-200">
                  <PhoneCall className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>تنسيق التجديد وسداد الرسوم:</span>
                </div>
                <p className="mt-1.5 leading-relaxed">
                  لتجديد الاشتراك أو استلام إيصال السداد، يرجى التواصل مع مسؤول الإدارة المركزية (م/ أبانوب وجيه) عبر قنوات التواصل المعتمدة أو الاتصال به مباشرة على رقم{' '}
                  <a
                    href="tel:01012348828"
                    dir="ltr"
                    className="inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-200 hover:text-amber-700 underline decoration-amber-400 underline-offset-2 px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/60 font-sans"
                  >
                    <Phone className="w-3 h-3" />
                    <span>01012348828</span>
                  </a>{' '}
                  أو تسجيل الحوالة.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href="tel:01012348828"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>اتصال: 01012348828</span>
                  </a>
                  <a
                    href="https://wa.me/201012348828"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    <span>مراسلة واتساب</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold hover:bg-stone-300 dark:hover:bg-stone-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
