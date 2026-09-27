import React from 'react';
import { useLanguage } from '../../context/LanguageContext.js';
import {
  Cross,
  BookOpen,
  Sparkles,
  Building2,
  CreditCard,
  CalendarCheck,
  CheckCircle2,
  Search,
  Shield,
  ArrowLeft,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

interface WelcomeLandingProps {
  onNavigateToLogin: () => void;
  onNavigateToPortal: () => void;
  onNavigateToScanner?: () => void;
  onNavigateToSuperAdmin?: () => void;
}

export const WelcomeLanding: React.FC<WelcomeLandingProps> = ({
  onNavigateToLogin,
  onNavigateToPortal,
  onNavigateToSuperAdmin,
}) => {
  const { isRtl } = useLanguage();

  return (
    <div className="min-h-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
      {/* Universal Platform Header */}
      <div className="text-center space-y-4 relative">
        <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-amber-700/20 border-2 border-amber-500/60 shadow-lg relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-700 text-white flex items-center justify-center shadow-md">
            <Cross className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>
        </div>

        <div className="space-y-2 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>المنصة السحابية الموحدة للكنائس والإيبارشيات</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-stone-900 dark:text-white font-serif tracking-tight leading-tight">
            أهلاً بك في نظام إدارة الخدمات الكنسية
          </h1>

          <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed font-medium max-w-2xl mx-auto">
            منظومة رقمية متكاملة لإدارة خدمات الكنائس وسجلات الخدام ومتابعة الحضور،
            مع عزل تام لكل كنيسة لضمان الخصوصية والسرية.
          </p>
        </div>
      </div>

      {/* 3 Clear Gateway Pathways */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pathway 1: Church Login */}
        <div
          id="card-gateway-church"
          onClick={onNavigateToLogin}
          className="p-6 rounded-3xl border-2 border-amber-600/30 hover:border-amber-600 bg-white dark:bg-stone-900 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-700 group-hover:bg-amber-800 text-white flex items-center justify-center shadow-md transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                تسجيل الكنائس
              </span>
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
              دخول الكنائس والخدام
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              مخصص للآباء الكهنة وأمناء الخدمة والخادمين لتسجيل الحضور، وإدارة الخدمات، وتعديل بيانات الخدام.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
            <span>تسجيل الدخول للكنيسة</span>
            {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>

        {/* Pathway 2: Servant Portal via National ID */}
        <div
          id="card-gateway-portal"
          onClick={onNavigateToPortal}
          className="p-6 rounded-3xl border-2 border-blue-500/30 hover:border-blue-500 bg-white dark:bg-stone-900 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-700 group-hover:bg-blue-800 text-white flex items-center justify-center shadow-md transition-colors">
                <Search className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                بدون كلمة سر
              </span>
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
              بوابة الخدام (بالرقم القومي)
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              استعلام سريع ومباشر لأي خادم عن بياناته، الكنيسة المسجل بها، كود الخدمة، ونسب حضوره.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
            <span>استعلام بالرقم القومي</span>
            {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>

        {/* Pathway 3: Super Admin Portal */}
        <div
          id="card-gateway-superadmin"
          onClick={onNavigateToSuperAdmin}
          className="p-6 rounded-3xl border-2 border-stone-800 dark:border-amber-500/30 hover:border-amber-500 bg-stone-900 text-stone-100 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-stone-950 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-md">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/40 font-mono">
                Super Admin
              </span>
            </div>
            <h3 className="text-base font-bold text-amber-100 font-serif">
              إدارة المنظومة (مدير المنصة)
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              خاص بمدير المنظومة (م/ أبانوب وجيه) لإنشاء الكنائس، وتعديل الاشتراكات، وإدارة صلاحيات النظام.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-stone-800 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
            <span>دخول المدير العام</span>
            {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Scripture Verse Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-amber-700/15 border-2 border-amber-300/70 dark:border-amber-700/50 p-6 sm:p-7 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-5 text-center md:text-right">
          <div className="w-12 h-12 rounded-2xl bg-amber-700 text-white flex items-center justify-center shrink-0 shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>آية الخدمة</span>
            </div>
            <p className="text-base sm:text-lg font-bold font-serif text-stone-900 dark:text-amber-100 leading-relaxed">
              «لأَنَّ اللهَ لَيْسَ بِظَالِمٍ حَتَّى يَنْسَى عَمَلَكُمْ وَتَعَبَ الْمَحَبَّةِ الَّتِي أَظْهَرْتُمُوهَا نَحْوَ اسْمِهِ، إِذْ قَدْ خَدَمْتُمُ الْقِدِّيسِينَ وَتَخْدِمُونَهُمْ»
            </p>
            <p className="text-xs font-semibold text-amber-800/90 dark:text-amber-300/90 font-serif">
              — رسالة بولس الرسول إلى العبرانيين (٦ : ١٠)
            </p>
          </div>
        </div>
      </div>

      {/* Platform Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-stone-900 dark:text-white">
            عزل تام لكل كنيسة
          </h4>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            بيانات منفصلة وخاصة بكل كنيسة، مع إمكانية إدارة متعددة الإيبارشيات من منصة واحدة.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-stone-900 dark:text-white">
            كارنيهات خدمة ذكية
          </h4>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            توليد بطاقات تعريف إلكترونية للخدام مع كود QR مشفر للتعريف ومسح الحضور.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-stone-900 dark:text-white">
            متابعة الحضور والغياب
          </h4>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            توثيق الحضور في الاجتماعات والخدمات مع حساب أوقات التأخير ونسب الالتزام.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-stone-900 dark:text-white">
            تقارير وإحصائيات فورية
          </h4>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            تصدير كشوف Excel، متابعة نسب الافتقاد، وتسهيل مهام أمناء الخدمة والآباء الكهنة.
          </p>
        </div>
      </div>
    </div>
  );
};
