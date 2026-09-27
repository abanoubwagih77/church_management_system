import React, { useRef } from 'react';
import { Printer, X, Cross } from 'lucide-react';
import { GeneralMeeting } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';

export interface MeetingDetailsData {
  meeting: GeneralMeeting;
  stats: {
    total_eligible: number;
    present_count: number;
    late_absent_count: number;
    absent_count: number;
    attendance_rate: number;
  };
  roster: Array<{
    servant_id: string;
    servant_name: string;
    servant_phone: string;
    service_id?: string;
    service_name?: string;
    current_role?: string;
    status: 'present' | 'completed' | 'late_absent' | 'absent' | 'priest_exempt';
    is_late?: boolean;
    is_priest?: boolean;
    check_in_time: string;
    check_in_time_formatted?: string;
    check_in_time_raw?: string | null;
    check_out_time?: string;
  }>;
}

interface PrintAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MeetingDetailsData | null;
}

export const PrintAttendanceModal: React.FC<PrintAttendanceModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const printableAreaRef = useRef<HTMLDivElement>(null);
  const { church } = useAuth();

  const churchName = church?.name || 'كنيسة الشهيد العظيم مارجرجس بمنية شبين القناطر';
  const diocese = church?.diocese || 'مطرانية شبين القناطر وتوابعها';
  const logoUrl = church?.logo_url || church?.branding?.logo_url;

  if (!isOpen || !data) return null;

  const { meeting, stats, roster } = data;

  const handlePrint = () => {
    // We create a hidden iframe and inject the clean printable HTML
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';

    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    const printContent = printableAreaRef.current?.innerHTML || '';

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>كشف حضور - ${meeting.title} - ${meeting.date}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Kufi Arabic', Tahoma, sans-serif;
              direction: rtl;
              margin: 0;
              padding: 0;
              color: #1c1917;
              background: #ffffff;
              font-size: 11pt;
            }
            .print-container {
              width: 100%;
              max-width: 100%;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #78350f;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .logo-img {
              width: 75px;
              height: 75px;
              border-radius: 50%;
              object-fit: cover;
            }
            .church-title {
              font-size: 14pt;
              font-weight: bold;
              color: #1c1917;
              margin: 0 0 4px 0;
            }
            .diocese-title {
              font-size: 10pt;
              color: #57534e;
              margin: 0;
            }
            .meeting-info-box {
              background: #fbfbfa;
              border: 1px solid #e7e5e4;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 12px;
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              font-size: 9.5pt;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 8pt;
              color: #78716c;
              font-weight: bold;
            }
            .info-val {
              font-size: 9.5pt;
              font-weight: bold;
              color: #1c1917;
            }
            .stats-bar {
              display: flex;
              gap: 12px;
              margin-bottom: 12px;
            }
            .stat-pill {
              flex: 1;
              border: 1px solid #d6d3d1;
              border-radius: 6px;
              padding: 6px 10px;
              text-align: center;
              background: #fafaf9;
            }
            .stat-pill-val {
              font-size: 12pt;
              font-weight: bold;
              display: block;
            }
            .stat-pill-lbl {
              font-size: 8pt;
              color: #57534e;
            }
            .roster-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              font-size: 9pt;
            }
            .roster-table th {
              background-color: #f5f5f4;
              border: 1px solid #d6d3d1;
              padding: 6px 8px;
              font-weight: bold;
              text-align: right;
            }
            .roster-table td {
              border: 1px solid #e7e5e4;
              padding: 5px 8px;
              text-align: right;
            }
            .roster-table tr:nth-child(even) {
              background-color: #fafaf9;
            }
            .badge-present {
              color: #15803d;
              font-weight: bold;
            }
            .badge-late {
              color: #b45309;
              font-weight: bold;
            }
            .badge-absent {
              color: #b91c1c;
              font-weight: bold;
            }
            .badge-priest {
              color: #6b21a8;
              font-weight: bold;
            }
            .signatures-box {
              margin-top: 24px;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
              page-break-inside: avoid;
            }
            .sign-col {
              border-top: 1px dashed #a8a29e;
              padding-top: 8px;
              font-size: 9.5pt;
              font-weight: bold;
              color: #44403c;
            }
            .sign-sub {
              font-size: 8pt;
              font-weight: normal;
              color: #78716c;
              margin-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${printContent}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 2000);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                معاينة وطباعة كشف حضور الخدام
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                كشف رسمي كنسي موثق لاجتماع: {meeting.title} ({meeting.date})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-trigger-print-sheet"
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف الآن</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Content Viewport */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-stone-100/60 dark:bg-stone-950/40">
          <div
            ref={printableAreaRef}
            className="bg-white text-stone-900 p-6 sm:p-8 rounded-xl shadow-xs border border-stone-200 mx-auto max-w-3xl"
            dir="rtl"
          >
            {/* Header with Official Church Logo */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-amber-800/80 gap-4">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={churchName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-amber-600/60 shadow-xs"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-100 border-2 border-amber-600/60 flex items-center justify-center text-amber-800 shadow-xs">
                    <Cross className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-bold font-serif text-stone-900">
                    {churchName}
                  </h1>
                  <p className="text-xs text-stone-600 font-medium">
                    {diocese} • منظومة رعاية ومتابعة الخدام
                  </p>
                  <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                    "كُونُوا أَمَنَاءَ إِلَى الْمَوْتِ فَسَأُعْطِيكَ إِكْلِيلَ الْحَيَاةِ" (رؤ 2: 10)
                  </p>
                </div>
              </div>

              <div className="text-left text-xs space-y-1 text-stone-600 shrink-0">
                <div>
                  <strong>التاريخ:</strong> {meeting.date}
                </div>
                <div>
                  <strong>اليوم:</strong>{' '}
                  {new Date(meeting.date + 'T00:00:00').toLocaleDateString('ar-EG', {
                    weekday: 'long',
                  })}
                </div>
                <div>
                  <strong>الوقت:</strong> {meeting.start_time} - {meeting.end_time}
                </div>
              </div>
            </div>

            {/* Meeting Info Summary */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="block text-[10px] text-stone-500 font-bold">اسم الاجتماع:</span>
                <span className="font-bold text-stone-900">{meeting.title}</span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 font-bold">المحاضر / المتكلم:</span>
                <span className="font-bold text-stone-900">{meeting.speaker || 'غير محدد'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 font-bold">موضوع الكلمة:</span>
                <span className="font-bold text-stone-900">{meeting.topic || 'عام'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 font-bold">موعد احتساب الغياب:</span>
                <span className="font-bold text-rose-700">{meeting.late_cutoff_time}</span>
              </div>
            </div>

            {/* Stats Summary Bar */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="border border-stone-200 rounded-lg p-2 text-center bg-stone-50/50">
                <span className="block text-sm font-bold text-stone-900">
                  {stats.total_eligible}
                </span>
                <span className="text-[10px] text-stone-500">إجمالي الخدام</span>
              </div>
              <div className="border border-emerald-200 rounded-lg p-2 text-center bg-emerald-50/40">
                <span className="block text-sm font-bold text-emerald-700">
                  {stats.present_count}
                </span>
                <span className="text-[10px] text-emerald-800">حضور في الموعد</span>
              </div>
              <div className="border border-amber-200 rounded-lg p-2 text-center bg-amber-50/40">
                <span className="block text-sm font-bold text-amber-700">
                  {stats.late_absent_count}
                </span>
                <span className="text-[10px] text-amber-800">متأخرين (حكم الغياب)</span>
              </div>
              <div className="border border-rose-200 rounded-lg p-2 text-center bg-rose-50/40">
                <span className="block text-sm font-bold text-rose-700">
                  {stats.absent_count}
                </span>
                <span className="text-[10px] text-rose-800">غياب</span>
              </div>
            </div>

            {/* Attendance Roster Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-y border-stone-300 text-stone-700">
                    <th className="py-2 px-2 text-right w-8">م</th>
                    <th className="py-2 px-3 text-right">اسم الخادم</th>
                    <th className="py-2 px-3 text-right">المرحلة / الخدمة</th>
                    <th className="py-2 px-3 text-right">المسمى</th>
                    <th className="py-2 px-3 text-center">الحالة</th>
                    <th className="py-2 px-3 text-center">وقت الحضور</th>
                    <th className="py-2 px-3 text-center w-24">التوقيع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {roster.map((item, idx) => {
                    const statusLabel =
                      item.is_priest
                        ? 'أب كاهن (معفى)'
                        : item.status === 'present' || item.status === 'completed'
                        ? 'حاضر'
                        : item.status === 'late_absent'
                        ? 'متأخر (غياب)'
                        : 'غائب';

                    const statusClass =
                      item.is_priest
                        ? 'text-purple-700 font-bold'
                        : item.status === 'present' || item.status === 'completed'
                        ? 'text-emerald-700 font-bold'
                        : item.status === 'late_absent'
                        ? 'text-amber-700 font-bold'
                        : 'text-rose-600 font-bold';

                    return (
                      <tr key={item.servant_id} className={idx % 2 === 1 ? 'bg-stone-50/60' : ''}>
                        <td className="py-1.5 px-2 text-stone-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-semibold text-stone-900">
                          {item.servant_name}
                        </td>
                        <td className="py-1.5 px-3 text-stone-600 text-[11px]">
                          {item.service_name || 'عام'}
                        </td>
                        <td className="py-1.5 px-3 text-stone-500 text-[11px]">
                          {item.current_role || 'خادم'}
                        </td>
                        <td className={`py-1.5 px-3 text-center text-[11px] ${statusClass}`}>
                          {statusLabel}
                        </td>
                        <td className="py-1.5 px-3 text-center font-mono text-[11px] text-stone-600">
                          {item.check_in_time_formatted || item.check_in_time || '—'}
                        </td>
                        <td className="py-1.5 px-3 text-center text-stone-300 font-serif">
                          {item.status === 'present' ? '✓' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official Signatures Footer */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-dashed border-stone-300 text-center text-xs text-stone-700 mt-6">
              <div>
                <p className="font-bold">أمين الخدمة / الاجتماع</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-stone-500">الاسم والتوقيع: .....................</p>
              </div>
              <div>
                <p className="font-bold">ختم الكنيسة</p>
                <div className="h-10 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border border-dashed border-stone-300 flex items-center justify-center text-[9px] text-stone-400">
                    ختم
                  </div>
                </div>
              </div>
              <div>
                <p className="font-bold">كاهن الكنيسة المسؤول</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-stone-500">الاسم والتوقيع: .....................</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Controls */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/80">
          <span className="text-xs text-stone-500 dark:text-stone-400">
            عدد الخدام في الكشف: {roster.length} خادم
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>تأكيد الطباعة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
