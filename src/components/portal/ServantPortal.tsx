import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { ServantPortalData } from '../../types/index.js';
import {
  Search,
  ShieldCheck,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Phone,
  Cross,
  Award,
  Home,
} from 'lucide-react';

interface ServantPortalProps {
  onBack?: () => void;
}

export const ServantPortal: React.FC<ServantPortalProps> = ({ onBack }) => {
  const { t, language } = useLanguage();
  const [nationalId, setNationalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<ServantPortalData | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = nationalId.trim();
    if (!cleanId) {
      setError(language === 'ar' ? 'يرجى إدخال الرقم القومي' : 'Please enter your National ID');
      return;
    }

    if (cleanId.length < 10 || !/^\d+$/.test(cleanId)) {
      setError(
        language === 'ar'
          ? 'الرقم القومي غير صالح، يجب أن يتكون من أرقام فقط'
          : 'Invalid National ID format. Must contain digits only.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setRateLimitSeconds(null);

    try {
      const res = await api.post<{ success: boolean; data: ServantPortalData; error?: string }>('/api/portal/verify', {
        national_id: cleanId,
      });
      if (res && res.data && res.data.servant) {
        setPortalData(res.data);
        setError(null);
      } else {
        setError(res?.error || 'خطأ في الرقم القومي أو غير مسجل بأي كنيسة');
        setPortalData(null);
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الرقم القومي أو غير مسجل بأي كنيسة');
      setPortalData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPortalData(null);
    setNationalId('');
    setError(null);
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 85) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
    if (percentage >= 70) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {onBack && (
        <div className="mb-4 no-print">
          <button
            id="btn-portal-back-to-home"
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400 text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>الرجوع للصفحة الرئيسية</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="text-center mb-8 no-print">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-600/60 text-amber-700 dark:text-amber-400 mb-3 shadow-md">
          <Cross className="w-8 h-8 text-amber-700 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white font-serif">
          {t('portal_title')}
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
          {t('portal_desc')}
        </p>
        <div className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
          {t('church_name')}
        </div>
      </div>

      {!portalData || !portalData.servant ? (
        /* National ID Search Card */
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200 dark:border-stone-800 max-w-xl mx-auto">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label
                htmlFor="input-national-id"
                className="block text-sm font-semibold text-stone-800 dark:text-stone-200 mb-1.5"
              >
                {t('portal_national_id_label')}
              </label>
              <div className="relative">
                <input
                  id="input-national-id"
                  type="text"
                  maxLength={14}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('portal_placeholder')}
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-amber-600 focus:outline-hidden transition-all placeholder:text-stone-400 placeholder:text-sm placeholder:tracking-normal"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="btn-portal-submit"
              type="submit"
              disabled={loading || nationalId.length < 10}
              className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('common_loading')}</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>{t('portal_btn_search')}</span>
                </>
              )}
            </button>
          </form>

          {/* Privacy Note */}
          <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800 flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{t('portal_privacy_note')}</span>
          </div>
        </div>
      ) : (
        /* Servant Profile Display */
        <div className="space-y-6">
          {/* Top Bar actions */}
          <div className="flex items-center justify-between no-print">
            <button
              id="btn-portal-back"
              onClick={handleReset}
              className="px-3.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-1.5"
            >
              <ChevronRight className="w-4 h-4" />
              <span>{language === 'ar' ? 'بحث عن خادم آخر' : 'Search another servant'}</span>
            </button>
            <button
              id="btn-portal-print"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('common_print')}</span>
            </button>
          </div>

          {/* Main Card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
            {/* Header with church seal & photo */}
            <div className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-950 p-6 text-white relative">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="w-24 h-24 rounded-full border-4 border-amber-500/80 overflow-hidden bg-stone-800 shadow-xl shrink-0 flex items-center justify-center">
                  {portalData.servant.profile_photo ? (
                    <img
                      src={portalData.servant.profile_photo}
                      alt={portalData.servant.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-stone-400" />
                  )}
                </div>

                <div className="text-center sm:text-start flex-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium mb-1 border border-amber-500/30">
                    <Sparkles className="w-3 h-3" />
                    <span>{t('portal_read_only_badge')}</span>
                  </div>
                  <h2 className="text-2xl font-bold font-serif">{portalData.servant.full_name}</h2>
                  <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-amber-200/90 font-medium">
                    <span>{t('portal_current_service')}: {portalData.servant.current_service_name}</span>
                    <span>•</span>
                    <span>{t('portal_role')}: {portalData.servant.current_role}</span>
                  </div>
                </div>

                {/* Big Attendance Rate Badge */}
                <div className="sm:text-end text-center shrink-0">
                  <div className="text-xs text-stone-300 mb-0.5 font-medium">{t('portal_attendance_rate')}</div>
                  <div className="text-4xl font-extrabold text-amber-400 font-mono tracking-tight">
                    {portalData.attendance_stats?.percentage ?? 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Breakdown Tiles */}
            <div className="p-6 border-b border-stone-100 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/50 dark:bg-stone-950/30">
              <div className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center">
                <span className="text-[11px] text-stone-500 dark:text-stone-400 block">{t('portal_total_meetings')}</span>
                <span className="text-xl font-bold text-stone-900 dark:text-white font-mono mt-0.5 block">
                  {portalData.attendance_stats?.total_meetings ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 text-center">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('portal_present_count')}
                </span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 block">
                  {portalData.attendance_stats?.present ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 text-center">
                <span className="text-[11px] text-rose-700 dark:text-rose-400 block flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {t('portal_absent_count')}
                </span>
                <span className="text-xl font-bold text-rose-700 dark:text-rose-400 font-mono mt-0.5 block">
                  {portalData.attendance_stats?.absent ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-center">
                <span className="text-[11px] text-amber-700 dark:text-amber-400 block flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t('portal_excused_count')}
                </span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-0.5 block">
                  {portalData.attendance_stats?.excused ?? 0}
                </span>
              </div>
            </div>

            {/* Basic Info */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-b border-stone-100 dark:border-stone-800">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                <span className="text-stone-500 dark:text-stone-400 block">{t('servant_national_id')} (المحمي)</span>
                <span className="font-mono font-semibold text-stone-800 dark:text-stone-200 mt-1 block tracking-wider" dir="ltr">
                  {portalData.servant.masked_national_id}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                <span className="text-stone-500 dark:text-stone-400 block">{t('portal_joining_date')}</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 mt-1 block">
                  {portalData.servant.joining_date || '-'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
                <span className="text-stone-500 dark:text-stone-400 block">{t('portal_service_start')}</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 mt-1 block">
                  {portalData.servant.service_start_date || '-'}
                </span>
              </div>
            </div>

            {/* Recent Attendance Log */}
            <div className="p-6">
              <h3 className="text-sm font-bold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>{t('portal_recent_attendance')}</span>
              </h3>

              {(!portalData.recent_attendance || portalData.recent_attendance.length === 0) ? (
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/30 text-center text-xs text-stone-500">
                  {language === 'ar' ? 'لا توجد سجلات حضور مسجلة بعد' : 'No attendance recorded yet'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-2">
                        <th className="py-2 font-medium">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="py-2 font-medium">{language === 'ar' ? 'الخدمة' : 'Service'}</th>
                        <th className="py-2 font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        <th className="py-2 font-medium">{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                      {(portalData.recent_attendance || []).map((rec) => (
                        <tr key={rec.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                          <td className="py-2.5 font-mono text-stone-700 dark:text-stone-300">{rec.date}</td>
                          <td className="py-2.5 text-stone-800 dark:text-stone-200">{rec.service_name}</td>
                          <td className="py-2.5">
                            {rec.status === 'present' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                {t('att_status_present')}
                              </span>
                            )}
                            {rec.status === 'absent' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                                <XCircle className="w-3 h-3" />
                                {t('att_status_absent')}
                              </span>
                            )}
                            {rec.status === 'excused' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                                <Clock className="w-3 h-3" />
                                {t('att_status_excused')}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-stone-500">{rec.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Assignments History */}
            {portalData.assignments_history && portalData.assignments_history.length > 0 && (
              <div className="p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-950/20">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>{t('portal_assignment_history')}</span>
                </h3>
                <div className="space-y-2">
                  {portalData.assignments_history.map((a, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{a.service_name}</span>
                        <span className="text-stone-500 dark:text-stone-400">({a.role})</span>
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono">
                        {a.start_date} {a.end_date ? `← ${a.end_date}` : '(الحالية)'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
