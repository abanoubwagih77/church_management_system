import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { ChurchService, AttendanceStatus } from '../../types/index.js';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  CheckCheck,
  Calendar,
  Layers,
  AlertCircle,
  History,
  Check,
  RotateCcw,
} from 'lucide-react';

interface AttendanceRecordInput {
  servant_id: string;
  servant_name: string;
  phone: string;
  cumulative_rate: number;
  has_history?: boolean;
  status: AttendanceStatus | null;
  notes: string;
}

interface AttendanceSheetProps {
  onNavigateToMeetings?: () => void;
}

export const AttendanceSheet: React.FC<AttendanceSheetProps> = ({ onNavigateToMeetings }) => {
  const { user, hasPermission, canAccessService } = useAuth();
  const { t, language } = useLanguage();

  const [services, setServices] = useState<ChurchService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [records, setRecords] = useState<AttendanceRecordInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch accessible services
  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await api.get<{ success: boolean; services: ChurchService[] }>('/api/services');
        let availableServices = res.services;
        if (user && user.scope !== 'all') {
          availableServices = availableServices.filter((s) => s.id === user.scope);
        }
        setServices(availableServices);
        if (availableServices.length > 0) {
          setSelectedServiceId(availableServices[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadServices();
  }, [user]);

  // Fetch attendance sheet for service & date
  const fetchSheet = useCallback(async () => {
    if (!selectedServiceId || !selectedDate) return;

    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await api.get<{ success: boolean; service: ChurchService; date: string; sheet: any[] }>(
        `/api/attendance/sheet?service_id=${selectedServiceId}&date=${selectedDate}`
      );

      const sheetList = Array.isArray(res?.sheet) ? res.sheet : [];
      const mapped: AttendanceRecordInput[] = sheetList.map((item) => ({
        servant_id: item.servant_id,
        servant_name: item.full_name || item.servant_name || 'خادم',
        phone: item.phone || '',
        cumulative_rate: item.attendance_rate !== undefined ? item.attendance_rate : 100,
        has_history: item.has_history,
        status: (item.status === 'present' || item.status === 'absent' || item.status === 'excused') ? item.status : null,
        notes: item.notes || '',
      }));

      setRecords(mapped);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل كشف الحضور');
    } finally {
      setLoading(false);
    }
  }, [selectedServiceId, selectedDate]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  const handleStatusChange = (servantId: string, status: AttendanceStatus) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.servant_id !== servantId) return r;
        // Clicking same status again toggles it off to unselected
        return { ...r, status: r.status === status ? null : status };
      })
    );
  };

  const handleNotesChange = (servantId: string, notes: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.servant_id === servantId ? { ...r, notes } : r))
    );
  };

  const handleMarkAllPresent = () => {
    setRecords((prev) => prev.map((r) => ({ ...r, status: 'present' })));
  };

  const handleClearAll = () => {
    setRecords((prev) => prev.map((r) => ({ ...r, status: null })));
  };

  const handleSave = async () => {
    if (!selectedServiceId || !selectedDate) return;

    const selectedRecords = records.filter((r) => r.status !== null);
    if (selectedRecords.length === 0) {
      setError('يرجى تحديد حالة الحضور (حاضر / غائب / معتذر) لخادم واحد على الأقل قبل الحفظ.');
      return;
    }

    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const payload = {
        service_id: selectedServiceId,
        date: selectedDate,
        records: selectedRecords.map((r) => ({
          servant_id: r.servant_id,
          status: r.status,
          notes: r.notes,
        })),
      };

      await api.post('/api/attendance/bulk', payload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
      fetchSheet();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ كشف الحضور');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = records.filter((r) => r.status === 'present').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const excusedCount = records.filter((r) => r.status === 'excused').length;
  const unmarkedCount = records.filter((r) => r.status === null).length;

  return (
    <div className="space-y-6">
      {/* Module Switcher Tabs */}
      {onNavigateToMeetings && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-stone-100 dark:bg-stone-800/80 rounded-2xl w-fit border border-stone-200 dark:border-stone-700">
          <button
            type="button"
            onClick={onNavigateToMeetings}
            className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-all flex items-center gap-2 cursor-pointer hover:bg-white/60 dark:hover:bg-stone-700/60"
          >
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>اجتماعات الخدام العامة (الباركود والمواعيد والمحاضرات)</span>
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-amber-600" />
            <span>كشوف حضور أسر ومراحل الخدمة</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            {t('att_title')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {t('att_desc')}
          </p>
        </div>

        {hasPermission('add_attendance') && records.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              title="تحديد كافة الخدام كحاضرين"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>{t('att_mark_all_present')}</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              title="إلغاء تحديد حالة الحضور للجميع"
            >
              <RotateCcw className="w-4 h-4 text-stone-500" />
              <span>إلغاء التحديد للجميع</span>
            </button>

            <button
              id="btn-save-attendance-sheet"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{t('att_save_sheet')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Selectors Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {services.length === 0 ? (
          <div className="p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>لا توجد خدمات كنسية مسجلة بعد. قم بإضافة الخدمات والمراحل أولاً من قسم "الخدمات".</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            {/* Service Selector */}
            <div className="flex-1 sm:flex-initial">
              <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                {t('att_select_service')}
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:ring-2 focus:ring-amber-600 focus:outline-hidden min-w-[200px]"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div className="flex-1 sm:flex-initial">
              <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                {t('att_select_date')}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Live Tally Badges */}
        {records.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 font-semibold">
              حاضر: {presentCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40 font-semibold">
              غائب: {absentCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40 font-semibold">
              اعتذار: {excusedCount}
            </span>
            {unmarkedCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 font-semibold">
                لم يُحدد بعد: {unmarkedCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>تم حفظ كشف الحضور بنجاح، وتمت إعادة احتساب النسب التراكمية وتوثيق العملية في سجل التدقيق.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Roster Sheet */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-stone-500">{t('common_loading')}</span>
          </div>
        ) : services.length === 0 ? (
          <div className="p-10 text-center">
            <Layers className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">
              لم يتم إنشاء أي خدمات كنسية حتى الآن
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              قم بإضافة مراحل وخدمات الكنيسة أولاً من قسم "الخدمات" لتتمكن من رصد الحضور والغياب.
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">
              لا يوجد خدام مسجلين في هذه الخدمة
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              تأكد من اختيار الخدمة المناسبة أو قم بتعيين خدام لهذه الخدمة من قسم "سجل الخدام".
            </p>
          </div>
        ) : (
          <div>
            {/* Mobile Responsive Attendance Cards */}
            <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800">
              {records.map((r, index) => (
                <div key={r.servant_id} className="p-4 space-y-3 bg-white dark:bg-stone-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 text-xs font-mono font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-stone-900 dark:text-white text-xs font-serif">
                          {r.servant_name}
                        </h4>
                        <span className="text-[11px] text-stone-400 font-mono block">
                          {r.phone}
                        </span>
                      </div>
                    </div>

                    {r.has_history === false ? (
                      <span className="px-2 py-0.5 rounded-full font-bold font-mono text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        100% (جديد)
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                          r.cumulative_rate >= 80
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {r.cumulative_rate}%
                      </span>
                    )}
                  </div>

                  {/* 3-way toggle buttons on mobile with big touch targets */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(r.servant_id, 'present')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[40px] ${
                        r.status === 'present'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>حاضر</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(r.servant_id, 'absent')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[40px] ${
                        r.status === 'absent'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>غائب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(r.servant_id, 'excused')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[40px] ${
                        r.status === 'excused'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>معتذر</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={r.notes}
                    onChange={(e) => handleNotesChange(r.servant_id, e.target.value)}
                    placeholder="ملاحظات أو عذر الغياب..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                  />
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="py-3 px-4 text-start">#</th>
                    <th className="py-3 px-4 text-start">{t('servant_name')}</th>
                    <th className="py-3 px-4 text-center">{t('att_rate_badge')}</th>
                    <th className="py-3 px-4 text-center">حالة الحضور</th>
                    <th className="py-3 px-4 text-start">ملاحظات أو عذر الغياب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                  {records.map((r, index) => (
                    <tr key={r.servant_id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-400">{index + 1}</td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 dark:text-white text-xs">
                          {r.servant_name}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          {r.phone}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {r.has_history === false ? (
                          <span className="inline-block px-2 py-0.5 rounded-full font-bold font-mono text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                            100% (جديد)
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                              r.cumulative_rate >= 80
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {r.cumulative_rate}%
                          </span>
                        )}
                      </td>

                      {/* Status radio toggle buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center rounded-xl bg-stone-100 dark:bg-stone-800 p-1 gap-1">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.servant_id, 'present')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                              r.status === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('att_status_present')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.servant_id, 'absent')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                              r.status === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t('att_status_absent')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.servant_id, 'excused')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                              r.status === 'excused'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{t('att_status_excused')}</span>
                          </button>
                        </div>
                      </td>

                      {/* Notes input */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={r.notes}
                          onChange={(e) => handleNotesChange(r.servant_id, e.target.value)}
                          placeholder="ملاحظات أو سبب العذر..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-1 focus:ring-amber-600 focus:outline-hidden"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
