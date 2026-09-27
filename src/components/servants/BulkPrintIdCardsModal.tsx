import React, { useState } from 'react';
import { X, Printer, Filter, CheckSquare, Square, Layers, Check, Download, FileText, Sparkles } from 'lucide-react';
import { Servant, ChurchService } from '../../types/index.js';
import { ServantBadgeCard } from './ServantBadgeCard.js';
import { useAuth } from '../../context/AuthContext.js';
import { generateA4SheetPdf } from '../../utils/idCardPdfGenerator.js';

interface BulkPrintIdCardsModalProps {
  isOpen: boolean;
  servants: Servant[];
  services: ChurchService[];
  onClose: () => void;
}

export const BulkPrintIdCardsModal: React.FC<BulkPrintIdCardsModalProps> = ({
  isOpen,
  servants,
  services,
  onClose,
}) => {
  const { church } = useAuth();
  const churchName = church?.name || 'كنيسة معتمدة';

  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedServantIds, setSelectedServantIds] = useState<string[]>(() =>
    servants.map((s) => s.id)
  );
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  if (!isOpen) return null;

  // Filter servants
  const filteredServants = servants.filter((s) => {
    if (selectedServiceId === 'all') return true;
    return s.current_service_id === selectedServiceId;
  });

  const isAllSelected =
    filteredServants.length > 0 &&
    filteredServants.every((s) => selectedServantIds.includes(s.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect filtered servants
      const filteredIds = new Set(filteredServants.map((s) => s.id));
      setSelectedServantIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      // Add all filtered servants
      const newIds = new Set([...selectedServantIds, ...filteredServants.map((s) => s.id)]);
      setSelectedServantIds(Array.from(newIds));
    }
  };

  const toggleServant = (id: string) => {
    setSelectedServantIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedList = filteredServants.filter((s) =>
    selectedServantIds.includes(s.id)
  );

  const handleExportA4Pdf = async () => {
    if (selectedList.length === 0) return;

    setIsExportingPdf(true);
    setExportProgress({ current: 0, total: selectedList.length });

    try {
      const cardEntries: { element: HTMLElement; name: string }[] = [];

      for (const s of selectedList) {
        const el = document.getElementById(`bulk-badge-${s.id}`);
        if (el) {
          cardEntries.push({ element: el, name: s.full_name });
        }
      }

      if (cardEntries.length === 0) {
        alert('لم يتم العثور على عناصر الكارنيهات في الصفحة. يرجى المحاولة مرة أخرى.');
        return;
      }

      await generateA4SheetPdf(cardEntries, churchName, (current, total) => {
        setExportProgress({ current, total });
      });
    } catch (err) {
      console.error('Error generating A4 sheet PDF:', err);
      // Fallback to native print dialog
      handlePrint();
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const cardsHtml = selectedList
      .map((s) => {
        const srv = services.find((sv) => sv.id === s.current_service_id);
        const cardEl = document.getElementById(`bulk-badge-${s.id}`);
        if (cardEl) {
          return `<div class="card-item">${cardEl.outerHTML}</div>`;
        }
        return '';
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>طباعة كارنيهات الخدام - ${churchName}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .header-print {
              text-align: center;
              margin-bottom: 12px;
              font-size: 14px;
              font-weight: bold;
              color: #333;
              border-bottom: 2px solid #ddd;
              padding-bottom: 6px;
            }
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
              justify-items: center;
              align-items: start;
            }
            .card-item {
              page-break-inside: avoid;
              break-inside: avoid;
              border: 1px dashed #aaa;
              padding: 4px;
              border-radius: 26px;
            }
          </style>
          <link rel="stylesheet" href="/src/index.css" />
        </head>
        <body>
          <div class="header-print">
            ${churchName} - كشف طباعة وتغليف كارنيهات الخدام (إجمالي: ${selectedList.length})
          </div>
          <div class="cards-grid">
            ${cardsHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-5xl w-full p-5 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
                طباعة كارنيهات الخدام دفعة واحدة (A4 Sheet)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                تجهيز وطباعة كارنيهات مرحلة معينة أو كافة الخدام مع كود الـ QR للقص والتغليف
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-500" />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              تصفية بالمرحلة:
            </span>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
            >
              <option value="all">كافة المراحل والخدمات ({servants.length})</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name_ar}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                  <span>إلغاء تحديد الكل</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-stone-500" />
                  <span>تحديد كل المعروض ({filteredServants.length})</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportA4Pdf}
              disabled={selectedList.length === 0 || isExportingPdf}
              className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              title="تصدير كروت الخدام كملف PDF مصفوف في صفحات A4 مع علامات القص الدقيقة"
            >
              {isExportingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    جاري التجهيز ({exportProgress?.current || 0}/{exportProgress?.total || 0})...
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تصدير PDF مصفوف للقص (A4)</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              disabled={selectedList.length === 0 || isExportingPdf}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة مباشرة ({selectedList.length})</span>
            </button>
          </div>
        </div>

        {/* Cards Preview Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-100/60 dark:bg-stone-950/40 rounded-2xl my-2 border border-stone-200 dark:border-stone-800/80">
          {filteredServants.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs">
              لا يوجد خدام في هذه المرحلة
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
              {filteredServants.map((s) => {
                const isSelected = selectedServantIds.includes(s.id);
                const srv = services.find((sv) => sv.id === s.current_service_id);
                return (
                  <div
                    key={s.id}
                    className={`relative p-2 rounded-3xl transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-3 ring-amber-500 bg-amber-500/10'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    onClick={() => toggleServant(s.id)}
                  >
                    <div className="absolute top-4 start-4 z-20">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-md ${
                          isSelected
                            ? 'bg-amber-600 border-white text-white'
                            : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>

                    <ServantBadgeCard
                      id={`bulk-badge-${s.id}`}
                      servant={s}
                      church={church}
                      serviceName={srv ? srv.name_ar : undefined}
                      className="transform scale-95 origin-top"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span>
            تم تحديد <strong className="text-stone-900 dark:text-white">{selectedList.length}</strong> كارنيه للطباعة
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
