import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  KeyRound,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  QrCode,
  Users,
  X,
  Plus,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { ScannerDevice, GeneralMeetingRecord } from '../../types/index.js';

interface ScannerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScannerApp: () => void;
}

export const ScannerManagementModal: React.FC<ScannerManagementModalProps> = ({
  isOpen,
  onClose,
  onOpenScannerApp,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'devices' | 'meeting_records'>('generate');

  // Generate code states
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Devices states
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState<boolean>(false);

  // Meeting records states
  const [meetingRecords, setMeetingRecords] = useState<GeneralMeetingRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // Countdown timer for 10-min OTP
  useEffect(() => {
    if (!codeExpiresAt) return;

    const updateTimer = () => {
      const remainingMs = new Date(codeExpiresAt).getTime() - Date.now();
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
      setSecondsRemaining(remainingSec);
      if (remainingSec === 0) {
        setCurrentCode(null);
        setCodeExpiresAt(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  // Load devices when tab active
  useEffect(() => {
    if (isOpen && activeTab === 'devices') {
      fetchDevices();
    } else if (isOpen && activeTab === 'meeting_records') {
      fetchMeetingRecords();
    }
  }, [isOpen, activeTab, selectedDate]);

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await api.get<{ success: boolean; devices: ScannerDevice[] }>(
        '/api/scanner/devices'
      );
      if (res.devices) {
        setDevices(res.devices);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchMeetingRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get<{
        success: boolean;
        records: GeneralMeetingRecord[];
      }>(`/api/scanner/general-meeting?date=${selectedDate}`);
      if (res.records) {
        setMeetingRecords(res.records);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post<{
        success: boolean;
        code: string;
        expires_at: string;
      }>('/api/scanner/code/generate');
      setCurrentCode(res.code);
      setCodeExpiresAt(res.expires_at);
      setCopied(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل توليد كود التسجيل';
      alert(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleDevice = async (id: string) => {
    try {
      const res = await api.patch<{ success: boolean; is_active: boolean }>(
        `/api/scanner/devices/${id}/toggle`
      );
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, is_active: res.is_active } : d))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تعديل حالة الجهاز';
      alert(msg);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف جهاز (${name}) نهائياً؟ لن يتمكن من تسجيل الحضور بعد الآن.`)) {
      return;
    }
    try {
      await api.delete(`/api/scanner/devices/${id}`);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حذف الجهاز';
      alert(msg);
    }
  };

  const handleCopyCode = () => {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base font-serif">
                إدارة أجهزة السكانر وتوثيق الهواتف
              </h3>
              <p className="text-xs text-stone-500">
                تسجيل هواتف الخدام الموثوقة لحضور اجتماع الخدام العام
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

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-6 bg-white dark:bg-stone-900 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'generate'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>توليد كود تسجيل جهاز (5 دقائق)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'devices'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>الأجهزة المعتمدة ({devices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('meeting_records')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'meeting_records'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>حضور اجتماع الخدام العام</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: Generate Code */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <p className="font-bold mb-1">💡 كيف يعمل توثيق الأجهزة؟</p>
                1. اضغط على زر توليد كود تسجيل جديد أدناه.<br />
                2. سيظهر كود من **8 أرقام** صالح لمدة **5 دقائق** فقط.<br />
                3. يقوم الخادم الموثوق بفتح صفحة السكانر على هاتفه وإدخال الكود مع اسم جهازه.<br />
                4. يتم توثيق الجهاز فوراً وتخزين مفتاح التشفير الآمن لديه ليتمكن من تسجيل الحضور والانصراف بانتظام.
              </div>

              {currentCode ? (
                <div className="bg-stone-50 dark:bg-stone-800/60 border-2 border-amber-500/50 rounded-2xl p-6 text-center space-y-4">
                  <span className="text-xs font-semibold text-stone-500 block">
                    كود تسجيل الجهاز المؤقت:
                  </span>
                  <div className="text-4xl sm:text-5xl font-mono font-extrabold tracking-widest text-amber-600 dark:text-amber-400 select-all">
                    {currentCode}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
                    <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>
                      ينتهي خلال: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} دقيقة
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full max-w-xs mx-auto bg-stone-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-full transition-all duration-1000"
                      style={{ width: `${(secondsRemaining / 300) * 100}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-4 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>توليد كود آخر</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center text-amber-600">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                      لا يوجد كود نشط حالياً
                    </h4>
                    <p className="text-xs text-stone-400 mt-1">
                      اضغط على الزر لتوليد كود تسجيل جديد مدته 5 دقائق
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center gap-2 mx-auto transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري التوليد...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>توليد كود تسجيل جديد (5 دقائق)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Direct Link to open Scanner */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-stone-800 dark:text-stone-200 block">
                    هل تريد تشغيل شاشة السكانر على هذا الجهاز مباشرة؟
                  </span>
                  <span className="text-[11px] text-stone-400">
                    يمكنك تشغيل الكاميرا ومسح الباركود مباشرة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScannerApp();
                  }}
                  className="px-4 py-2 bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 text-white dark:text-stone-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>فتح شاشة السكانر</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Devices List */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  قائمة الأجهزة الموثوقة لتسجيل الحضور والانصراف:
                </span>
                <button
                  type="button"
                  onClick={fetchDevices}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث</span>
                </button>
              </div>

              {loadingDevices ? (
                <div className="py-12 text-center text-xs text-stone-500">جاري تحميل الأجهزة...</div>
              ) : devices.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  لا توجد أجهزة مسجلة حتى الآن. قم بتوليد كود تسجيل لتسجيل أول جهاز.
                </div>
              ) : (
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-200 dark:divide-stone-800">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-stone-900"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            device.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                              {device.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                device.is_active
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                              }`}
                            >
                              {device.is_active ? 'نشط وموثوق' : 'معطل / مسحوب الثقة'}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            سُجّل بتاريخ:{' '}
                            {new Date(device.registered_at).toLocaleDateString('ar-EG')} • إجمالي
                            العمليات: {device.total_scans}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleDevice(device.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            device.is_active
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {device.is_active ? 'تعطيل الثقة' : 'إعادة التفعيل'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                          className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="حذف الجهاز نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Meeting Records */}
          {activeTab === 'meeting_records' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                    تاريخ الاجتماع:
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchMeetingRecords}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث السجل</span>
                </button>
              </div>

              {loadingRecords ? (
                <div className="py-12 text-center text-xs text-stone-500">جاري تحميل السجلات...</div>
              ) : meetingRecords.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  لا توجد سجلات حضور مسجلة لهذا التاريخ.
                </div>
              ) : (
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-semibold">
                      <tr>
                        <th className="p-3">اسم الخادم</th>
                        <th className="p-3">المرحلة / الخدمة</th>
                        <th className="p-3">وقت الدخول</th>
                        <th className="p-3">وقت الانصراف</th>
                        <th className="p-3">مدة التواجد</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">جهاز السكانر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-stone-800 dark:text-stone-200">
                      {meetingRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                          <td className="p-3 font-semibold">{r.servant_name}</td>
                          <td className="p-3">{r.service_name}</td>
                          <td className="p-3 font-mono">
                            {new Date(r.check_in_time).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3 font-mono">
                            {r.check_out_time
                              ? new Date(r.check_out_time).toLocaleTimeString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="p-3 font-semibold">
                            {r.duration_minutes !== undefined ? `${r.duration_minutes} دقيقة` : '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {r.status === 'completed' ? 'انصرف' : 'متواجد حالياً'}
                            </span>
                          </td>
                          <td className="p-3 text-stone-400">{r.scanner_device_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
