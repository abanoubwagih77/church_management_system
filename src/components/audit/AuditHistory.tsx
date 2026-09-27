import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { AuditLog } from '../../types/index.js';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Printer,
  FileDown,
  AlertCircle,
} from 'lucide-react';

export const AuditHistory: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (actionFilter) params.append('action', actionFilter);
      if (targetTypeFilter) params.append('target_type', targetTypeFilter);

      const res = await api.get<{ success: boolean; total: number; logs: AuditLog[] }>(
        `/api/audit?${params.toString()}`
      );
      setLogs(res.logs);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب سجل العمليات');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, targetTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN')) {
      return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300';
    }
    if (action.includes('CREATED') || action.includes('ADDED')) {
      return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300';
    }
    if (action.includes('DELETED')) {
      return 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300';
    }
    if (action.includes('PERMISSION') || action.includes('ROLE')) {
      return 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300';
    }
    return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            {t('audit_title')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {t('audit_desc')}
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('common_print')}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-3 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في سجل العمليات والتغييرات..."
            className="w-full ps-9 pe-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-stone-400 absolute start-3 top-2.5 pointer-events-none" />
        </div>

        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
        >
          <option value="">نوع العنصر (الكل)</option>
          <option value="SERVANT">خدام (SERVANT)</option>
          <option value="ATTENDANCE">حضور وغياب (ATTENDANCE)</option>
          <option value="USER">مستخدمين (USER)</option>
          <option value="SERVICE">خدمات (SERVICE)</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-stone-500">{t('common_loading')}</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">
              سجل التدقيق فارغ حالياً
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              تظهر هنا تلقائياً كافة عمليات الإضافة والتعديل والحذف وتغيير الصلاحيات فور حدوثها.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasChanges = log.changes && (log.changes.before || log.changes.after);

              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-tight ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                      <span className="text-xs font-bold text-stone-900 dark:text-white">
                        @{log.username}
                      </span>
                      {log.target_name && (
                        <span className="text-xs text-stone-500 dark:text-stone-400">
                          ← <strong className="text-stone-700 dark:text-stone-300">{log.target_name}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-stone-400 font-mono">
                      {log.ip_address && (
                        <span className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-sm">
                          IP: {log.ip_address}
                        </span>
                      )}
                      <span>
                        {new Date(log.timestamp).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 dark:text-stone-300 mt-2 leading-relaxed">
                    {log.description}
                  </p>

                  {/* Changes Inspection Toggle */}
                  {hasChanges && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'إخفاء تفاصيل التغييرات' : 'عرض تفاصيل التغيير (Before / After)'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 font-mono text-[11px] overflow-x-auto space-y-2 border border-stone-200 dark:border-stone-700">
                          {log.changes.before && (
                            <div>
                              <span className="text-rose-600 dark:text-rose-400 font-bold block mb-1">
                                [الحالة السابقة - Before]:
                              </span>
                              <pre className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                                {JSON.stringify(log.changes.before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.changes.after && (
                            <div>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold block mb-1">
                                [الحالة الجديدة - After]:
                              </span>
                              <pre className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                                {JSON.stringify(log.changes.after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
