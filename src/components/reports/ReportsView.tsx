import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { ChurchService } from '../../types/index.js';
import {
  FileSpreadsheet,
  Printer,
  FileDown,
  Layers,
  Award,
  CheckCircle2,
  Calendar,
  Cross,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { user, church } = useAuth();
  const { t, language } = useLanguage();

  const [reportChurch, setReportChurch] = useState<any>(church);

  useEffect(() => {
    if (church) {
      setReportChurch(church);
    }
  }, [church]);

  const activeChurch = reportChurch || church;
  const churchName = activeChurch?.name || 'كنيسة معتمدة';
  const diocese = activeChurch?.diocese || '';
  const logoUrl = activeChurch?.logo_url || activeChurch?.branding?.logo_url;

  const [services, setServices] = useState<ChurchService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get<{ success: boolean; services: ChurchService[] }>('/api/services');
        let avail = res.services;
        if (user && user.scope !== 'all') {
          avail = avail.filter((s) => s.id === user.scope);
        }
        setServices(avail);
      } catch (e) {
        console.error(e);
      }
    };
    fetchServices();
  }, [user]);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const param = selectedServiceId ? `?service_id=${selectedServiceId}` : '';
      const res = await api.get<{ success: boolean; roster: any[]; church?: any }>(`/api/reports/roster${param}`);
      setRoster(res.roster || []);
      if (res.church) {
        setReportChurch(res.church);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [selectedServiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (roster.length === 0) return;
    const headers = ['الاسم', 'الهاتف', 'الخدمة', 'الدور', 'الحالة', 'نسبة الحضور', 'تاريخ الانضمام'];
    const rows = roster.map((r) => [
      `"${r.full_name}"`,
      `"${r.phone}"`,
      `"${r.service_name}"`,
      `"${r.role}"`,
      `"${r.status}"`,
      `"${r.attendance_rate}"`,
      `"${r.joining_date}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeChurchFileName = (churchName || 'church').replace(/[\s/\\?%*:|"<>]+/g, '_');
    link.setAttribute('download', `${safeChurchFileName}_servants_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            {t('nav_reports')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {language === 'ar'
              ? 'كشوف الخدام المعتمدة، نسب الحضور، والتقارير الموجهة للأب الكاهن'
              : 'Official Servant Rosters & Attendance Reports for Archdiocesan Review'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={roster.length === 0}
            className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>{t('common_export')}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('common_print')}</span>
          </button>
        </div>
      </div>

      {/* Filter by service */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex items-center gap-3 no-print">
        <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
          تصفية الخدمة:
        </label>
        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-semibold"
        >
          <option value="">كافة الخدمات</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name_ar}
            </option>
          ))}
        </select>
      </div>

      {/* Official Printable Sheet Paper */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-6 sm:p-8 print:border-none print:shadow-none print:p-0">
        {/* Printable Header */}
        <div className="text-center pb-6 border-b border-stone-200 dark:border-stone-800 mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={churchName}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-600 shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-600 flex items-center justify-center text-amber-700 dark:text-amber-400">
                <Cross className="w-7 h-7" />
              </div>
            )}
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-serif font-medium">
            {diocese}
          </p>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white font-serif mt-0.5">
            {churchName}
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-400 font-bold mt-1">
            تقرير كشف الخدام والتكليفات الكنسية ونسب الحضور
          </p>
          <div className="mt-2 text-[11px] text-stone-500 font-mono">
            تاريخ استخراج التقرير: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-stone-500">{t('common_loading')}</span>
          </div>
        ) : roster.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            لا توجد بيانات متاحة للعرض في هذا التقرير
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-700">
                <tr>
                  <th className="py-2.5 px-3 text-start">#</th>
                  <th className="py-2.5 px-3 text-start">اسم الخادم</th>
                  <th className="py-2.5 px-3 text-start">الهاتف</th>
                  <th className="py-2.5 px-3 text-start">الخدمة المسندة</th>
                  <th className="py-2.5 px-3 text-start">الدور</th>
                  <th className="py-2.5 px-3 text-center">نسبة الحضور</th>
                  <th className="py-2.5 px-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {roster.map((r, i) => (
                  <tr key={i} className="hover:bg-stone-50/50">
                    <td className="py-2.5 px-3 font-mono text-stone-400">{i + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-white">
                      {r.full_name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-stone-600 dark:text-stone-400" dir="ltr">
                      {r.phone}
                    </td>
                    <td className="py-2.5 px-3 text-stone-800 dark:text-stone-200">
                      {r.service_name}
                    </td>
                    <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-medium">
                      {r.role}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {r.attendance_rate}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'نشط'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures Footer for print */}
        <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-800 grid grid-cols-2 text-center text-xs">
          <div>
            <span className="font-bold block text-stone-800 dark:text-stone-200">أمين الخدمة</span>
            <div className="mt-8 text-stone-400">..................................</div>
          </div>
          <div>
            <span className="font-bold block text-stone-800 dark:text-stone-200">الأب الكاهن المسئول</span>
            <div className="mt-8 text-stone-400">..................................</div>
          </div>
        </div>
      </div>
    </div>
  );
};
