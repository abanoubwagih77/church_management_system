import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  History,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  Briefcase,
  Layers,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { Servant, ChurchService, ServiceAssignment } from '../../types/index.js';

interface ServantTransferModalProps {
  isOpen: boolean;
  servant: Servant | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ServantTransferModal: React.FC<ServantTransferModalProps> = ({
  isOpen,
  servant,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');
  const [services, setServices] = useState<ChurchService[]>([]);
  const [history, setHistory] = useState<
    (ServiceAssignment & { service_name?: string })[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [newServiceId, setNewServiceId] = useState('');
  const [newRole, setNewRole] = useState('خادم');
  const [copticYear, setCopticYear] = useState('1740-1741 ش (2025-2026 م)');
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen && servant) {
      fetchServices();
      fetchHistory();
      setNewRole(servant.current_role || 'خادم');
      setNewServiceId('');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, servant]);

  const fetchServices = async () => {
    try {
      const res = await api.get<{ services: ChurchService[] }>('/api/services');
      if (res.services) {
        setServices(res.services);
      }
    } catch {
      // ignore
    }
  };

  const fetchHistory = async () => {
    if (!servant) return;
    setLoadingHistory(true);
    try {
      const res = await api.get<{
        success: boolean;
        history: (ServiceAssignment & { service_name?: string })[];
      }>(`/api/servants/${servant.id}/history`);
      if (res.history) {
        setHistory(res.history);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servant || !newServiceId) {
      setError('يرجى اختيار المرحلة أو الخدمة الجديدة المراد النقل إليها');
      return;
    }

    if (newServiceId === servant.current_service_id) {
      setError('الخادم موجود بالفعل في هذه الخدمة. يرجى اختيار خدمة أخرى.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/api/servants/${servant.id}/transfer`,
        {
          new_service_id: newServiceId,
          new_role: newRole,
          coptic_year: copticYear,
          start_date: startDate,
          notes: notes.trim() || undefined,
        }
      );

      setSuccessMsg(res.message);
      fetchHistory();
      onSuccess();
      setTimeout(() => {
        setActiveTab('history');
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل نقل الخادم';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !servant) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base font-serif">
                نقل وتوزيع سنوي للخدمة: {servant.full_name}
              </h3>
              <p className="text-xs text-stone-500">
                الخدمة الحالية: {servant.service_name || 'غير محدد'} ({servant.current_role})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-6 bg-white dark:bg-stone-900 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transfer'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>نقل لمرحلة / خدمة جديدة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل تاريخ وسنوات الخدمة ({history.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'transfer' && (
            <form onSubmit={handleTransfer} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 rounded-xl p-3.5 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                سيتم أرشفة خدمة الخادم الحالية في سجل وسنوات الخدمة، ونقله فوراً إلى المرحلة الجديدة، وتحديث صلاحيات حسابه تلقائياً إذا كان منسقاً أو أميناً لمرحلة.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    المرحلة / الخدمة الجديدة <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newServiceId}
                    onChange={(e) => setNewServiceId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                  >
                    <option value="">-- اختر الخدمة الجديدة --</option>
                    {services
                      .filter((s) => s.id !== servant.current_service_id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name_ar}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    الدور في الخدمة الجديدة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                  >
                    <option value="خادم">خادم</option>
                    <option value="خادمة">خادمة</option>
                    <option value="أمين خدمة">أمين خدمة مرحلة</option>
                    <option value="مساعد أمين">مساعد أمين مرحلة</option>
                    <option value="مسؤول وسائل إيضاح">مسؤول وسائل إيضاح وأنشطة</option>
                    <option value="مسؤول افتقاد">مسؤول افتقاد</option>
                    <option value="مسؤول مالي">مسؤول مالي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    السنة القبطية / العام الدراسي
                  </label>
                  <input
                    type="text"
                    value={copticYear}
                    onChange={(e) => setCopticYear(e.target.value)}
                    placeholder="مثال: 1740-1741 ش (2025-2026 م)"
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    تاريخ بدء الخدمة بالمرحلة الجديدة
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات أو سبب النقل (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات بخصوص هذا التوزيع أو المهام الموكلة إليه..."
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 dark:text-stone-300 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري النقل والتحديث...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>تأكيد النقل والأرشفة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  سجل المراحل والسنوات السابقة التي خدم بها الخادم:
                </span>
              </div>

              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-stone-500">جاري تحميل السجل...</div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  لا توجد تكليفات خدمة سابقة مؤرشفة لهذا الخادم حتى الآن.
                </div>
              ) : (
                <div className="relative border-r-2 border-amber-500/40 mr-3 space-y-6 py-2">
                  {history.map((h, i) => (
                    <div key={h.id || i} className="relative pr-6">
                      <div
                        className={`absolute -right-[7px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-stone-900 ${
                          h.status === 'active' ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-stone-400'
                        }`}
                      />
                      <div className="bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 rounded-xl p-3.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                            {h.service_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
                            }`}
                          >
                            {h.status === 'active' ? 'الخدمة الحالية' : 'خدمة سابقة'}
                          </span>
                        </div>
                        <div className="text-stone-600 dark:text-stone-400">
                          الدور: <strong className="text-stone-800 dark:text-stone-200">{h.role}</strong> • السنة القبطية: {h.coptic_year}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          تاريخ البدء: {h.start_date} {h.end_date ? `• حتى: ${h.end_date}` : '• مستمر حتى الآن'}
                        </div>
                        {h.notes && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t border-stone-200/50 dark:border-stone-700/40">
                            ملاحظات: {h.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
