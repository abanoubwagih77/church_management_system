import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  Users,
  Search,
  Volume2,
  VolumeX,
  Camera,
  RefreshCw,
  ShieldCheck,
  Building,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../../services/api.js';

interface ScanResultData {
  action_type: 'check_in' | 'check_out' | 'duplicate_warning' | 'late_absent' | 'priest_exempt';
  message: string;
  meeting_title?: string;
  cutoff_time?: string;
  is_priest?: boolean;
  servant?: {
    id: string;
    full_name: string;
    phone: string;
    service_name: string;
    current_role: string;
    profile_photo?: string;
  };
  time?: string;
  initial_check_in?: string;
  elapsed_minutes?: number;
  duration_text?: string;
  device_name?: string;
}

interface GeneralMeetingStats {
  total_attended: number;
  currently_inside: number;
  completed_departure: number;
  average_duration_minutes: number;
}

const SCANNER_TOKEN_KEY = 'st_george_scanner_token';
const SCANNER_NAME_KEY = 'st_george_scanner_device_name';

export const ScannerDeviceView: React.FC<{ onBackToMain?: () => void }> = ({ onBackToMain }) => {
  const [deviceToken, setDeviceToken] = useState<string | null>(() => localStorage.getItem(SCANNER_TOKEN_KEY));
  const [deviceName, setDeviceName] = useState<string>(() => localStorage.getItem(SCANNER_NAME_KEY) || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [deviceValid, setDeviceValid] = useState<boolean>(false);
  const [regCode, setRegCode] = useState<string>('');
  const [newDeviceName, setNewDeviceName] = useState<string>('');
  const [regError, setRegError] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Scanner states
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResultData[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [stats, setStats] = useState<GeneralMeetingStats>({
    total_attended: 0,
    currently_inside: 0,
    completed_departure: 0,
    average_duration_minutes: 0,
  });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTimeRef = useRef<{ [code: string]: number }>({});

  // Sound generator using Web Audio API
  const playBeep = (type: 'check_in' | 'check_out' | 'warning' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'check_in') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'check_out') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.1); // C5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(370, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  // Verify device token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!deviceToken) {
        setIsVerifying(false);
        setDeviceValid(false);
        return;
      }

      try {
        const res = await api.post<{ valid: boolean; device: { name: string } }>(
          '/api/scanner/verify-token',
          { device_token: deviceToken }
        );
        if (res.valid) {
          setDeviceValid(true);
          setDeviceName(res.device.name);
          localStorage.setItem(SCANNER_NAME_KEY, res.device.name);
          fetchMeetingStats();
        } else {
          setDeviceValid(false);
        }
      } catch (err) {
        setDeviceValid(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [deviceToken]);

  // Fetch live stats for today's meeting
  const fetchMeetingStats = async () => {
    try {
      const res = await api.get<{ stats: GeneralMeetingStats }>('/api/scanner/general-meeting');
      if (res.stats) {
        setStats(res.stats);
      }
    } catch {
      // ignore
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError('');
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('reader');
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.max(220, Math.floor(minEdge * 0.75));
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleProcessScan(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );
      setCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر فتح الكاميرا. يرجى إعطاء الإذن للمتصفح.';
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current && cameraActive) {
      try {
        await html5QrCodeRef.current.stop();
        setCameraActive(false);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (deviceValid) {
      startCamera();
    }
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [deviceValid]);

  // Core scan processing
  const handleProcessScan = async (rawData: string) => {
    if (isProcessing) return;
    const cleanStr = rawData.trim();
    if (!cleanStr) return;

    // Client-side debounce to prevent reading same barcode 10 times in 1 second
    const now = Date.now();
    const lastTime = lastScannedTimeRef.current[cleanStr] || 0;
    if (now - lastTime < 3000) {
      return;
    }
    lastScannedTimeRef.current[cleanStr] = now;

    setIsProcessing(true);
    try {
      const res = await api.post<ScanResultData>('/api/scanner/scan', {
        device_token: deviceToken,
        qr_data: cleanStr,
      });

      setScanResult(res);
      setScanHistory((prev) => [res, ...prev.slice(0, 19)]);
      fetchMeetingStats();

      if (res.action_type === 'check_in' || res.action_type === 'priest_exempt') {
        playBeep('check_in');
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } else if (res.action_type === 'check_out') {
        playBeep('check_out');
      } else if (res.action_type === 'late_absent') {
        playBeep('error');
      } else if (res.action_type === 'duplicate_warning') {
        playBeep('warning');
      }
    } catch (err: unknown) {
      playBeep('error');
      const errMessage = err instanceof Error ? err.message : 'حدث خطأ أثناء قراءة الكود';
      setScanResult({
        action_type: 'duplicate_warning',
        message: errMessage,
      });
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 1200);
    }
  };

  // Register device with 8-digit OTP
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regCode || regCode.trim().length !== 8) {
      setRegError('يرجى إدخال كود التسجيل المكون من 8 أرقام بدقة');
      return;
    }
    if (!newDeviceName.trim()) {
      setRegError('يرجى كتابة اسم تعريفي للجهاز (مثال: موبايل مينا - بوابة الكنيسة)');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await api.post<{
        success: boolean;
        device_token: string;
        device: { name: string };
      }>('/api/scanner/devices/register', {
        code: regCode.trim(),
        device_name: newDeviceName.trim(),
      });

      localStorage.setItem(SCANNER_TOKEN_KEY, res.device_token);
      localStorage.setItem(SCANNER_NAME_KEY, res.device.name);
      setDeviceToken(res.device_token);
      setDeviceName(res.device.name);
      setDeviceValid(true);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الجهاز';
      setRegError(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUnlinkDevice = () => {
    if (window.confirm('هل أنت متأكد من إلغاء ربط هذا الجهاز؟ ستحتاج إلى كود جديد من الإدارة لإعادة ربطه.')) {
      stopCamera();
      localStorage.removeItem(SCANNER_TOKEN_KEY);
      localStorage.removeItem(SCANNER_NAME_KEY);
      setDeviceToken(null);
      setDeviceName('');
      setDeviceValid(false);
      setScanResult(null);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-stone-600 dark:text-stone-300 font-medium">جاري التحقق من هوية جهاز السكانر...</p>
      </div>
    );
  }

  // 1. Device NOT Registered: Show pairing screen
  if (!deviceValid) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 my-6">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-6 text-white text-center">
            <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-sm">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold font-serif mb-1">توثيق جهاز تسجيل الحضور (سكانر)</h2>
            <p className="text-xs text-amber-100 font-sans">
              كنيسة الشهيد العظيم مارجرجس بمنية شبين القناطر
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegisterDevice} className="p-6 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <p className="font-bold mb-1">🔒 نظام أمني لحماية الحضور:</p>
              لتسجيل الحضور عبر هاتفك، اطلب من الأب الكاهن أو أمين الخدمة العام توليد **كود تسجيل جهاز (8 أرقام)**، ثم أدخله هنا لربط جهازك بشكل موثوق دون الحاجة لكلمة مرور كل مرة.
            </div>

            {regError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                كود التسجيل من الإدارة (8 أرقام) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={regCode}
                onChange={(e) => setRegCode(e.target.value.replace(/\D/g, ''))}
                placeholder="مثال: 48291034"
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-center text-xl font-mono tracking-widest font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-stone-400 mt-1">كود التسجيل صالح لمدة 5 دقائق فقط من وقت توليده</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                اسم الجهاز التعريفي <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="مثال: موبايل بيشوي - بوابة الكنيسة"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isRegistering ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التوثيق والربط...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>توثيق الجهاز والبدء</span>
                </>
              )}
            </button>

            {onBackToMain && (
              <button
                type="button"
                onClick={onBackToMain}
                className="w-full py-2 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              >
                العودة للرئيسية
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // 2. Device IS Registered: Scanner Active
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Device Info Bar */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                {deviceName}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                جهاز موثوق
              </span>
            </div>
            <p className="text-xs text-stone-500">اجتماع الخدام العام • كنيسة الشهيد العظيم مارجرجس</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
          </button>
          <button
            type="button"
            onClick={fetchMeetingStats}
            title="تحديث الإحصائيات"
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleUnlinkDevice}
            title="إلغاء ربط الجهاز"
            className="p-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Meeting Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3.5 shadow-sm text-center">
          <span className="text-xs text-stone-500 font-medium block mb-1">إجمالي الحضور اليوم</span>
          <span className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-serif">
            {stats.total_attended}
          </span>
        </div>
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3.5 shadow-sm text-center">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium block mb-1">المتواجدون حالياً</span>
          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-serif">
            {stats.currently_inside}
          </span>
        </div>
        <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3.5 shadow-sm text-center">
          <span className="text-xs text-blue-700 dark:text-blue-400 font-medium block mb-1">المنصرفون</span>
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-serif">
            {stats.completed_departure}
          </span>
        </div>
        <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl p-3.5 shadow-sm text-center">
          <span className="text-xs text-purple-700 dark:text-purple-400 font-medium block mb-1">متوسط المدة</span>
          <span className="text-xl font-bold text-purple-700 dark:text-purple-300 font-serif">
            {stats.average_duration_minutes > 0 ? `${stats.average_duration_minutes} د` : '—'}
          </span>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Camera Scanner Box */}
        <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-600" />
              <span>كاميرا قراءة QR الخادم</span>
            </h4>
            <div className="flex items-center gap-2">
              {cameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-2.5 py-1 text-xs bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 rounded-lg text-stone-700 dark:text-stone-300 transition-colors"
                >
                  إيقاف الكاميرا
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  تشغيل الكاميرا
                </button>
              )}
            </div>
          </div>

          {cameraError && (
            <div className="w-full p-3 mb-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
              {cameraError}
            </div>
          )}

          {/* Video Container for html5-qrcode */}
          <div className="w-full max-w-sm aspect-square bg-stone-100 dark:bg-stone-950 rounded-2xl overflow-hidden relative border-2 border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center">
            <div id="reader" className="w-full h-full" />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
                <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-semibold">جاري تسجيل البيانات...</span>
              </div>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div className="w-full mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5">
              أو كتابة رقم الخادم / الرقم القومي / الموبايل يدوياً:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleProcessScan(manualInput);
                    setManualInput('');
                  }
                }}
                placeholder="أدخل كود الكارنيه أو رقم الهاتف أو الرقم القومي..."
                className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  handleProcessScan(manualInput);
                  setManualInput('');
                }}
                disabled={!manualInput.trim() || isProcessing}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                تسجيل
              </button>
            </div>
          </div>
        </div>

        {/* Right: Last Scan Result Card & Real-time Feedback */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>نتيجة المسح الحالية</span>
            </h4>

            {scanResult ? (
              <div
                className={`p-4 rounded-xl border text-sm transition-all ${
                  scanResult.action_type === 'check_in'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                    : scanResult.action_type === 'check_out'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                    : scanResult.action_type === 'late_absent'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                    : scanResult.action_type === 'priest_exempt'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {scanResult.action_type === 'check_in' && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {scanResult.action_type === 'check_out' && (
                    <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  )}
                  {scanResult.action_type === 'late_absent' && (
                    <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  {scanResult.action_type === 'priest_exempt' && (
                    <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  )}
                  {scanResult.action_type === 'duplicate_warning' && (
                    <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 ${
                        scanResult.action_type === 'check_in'
                          ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                          : scanResult.action_type === 'check_out'
                          ? 'bg-blue-200/80 text-blue-900 dark:bg-blue-900 dark:text-blue-200'
                          : scanResult.action_type === 'late_absent'
                          ? 'bg-rose-200/90 text-rose-950 dark:bg-rose-900 dark:text-rose-100'
                          : scanResult.action_type === 'priest_exempt'
                          ? 'bg-indigo-200/90 text-indigo-950 dark:bg-indigo-900 dark:text-indigo-100'
                          : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                      }`}
                    >
                      {scanResult.action_type === 'check_in' && '✅ تسجيل حضور (دخول)'}
                      {scanResult.action_type === 'check_out' && '🚪 تسجيل انصراف (خروج)'}
                      {scanResult.action_type === 'late_absent' && '⚠️ غياب (تأخر بعد الموعد المحدد)'}
                      {scanResult.action_type === 'priest_exempt' && '🕊️ أب كاهن (معفى من كشف الحضور)'}
                      {scanResult.action_type === 'duplicate_warning' && '⚠️ تسجيل مكرر'}
                    </span>

                    {scanResult.meeting_title && (
                      <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1">
                        الاجتماع: <span className="font-bold">{scanResult.meeting_title}</span>
                      </div>
                    )}

                    <p className="font-semibold text-sm leading-relaxed mb-2">
                      {scanResult.message}
                    </p>

                    {scanResult.servant && (
                      <div className="bg-white/70 dark:bg-stone-900/70 p-3 rounded-lg border border-black/5 dark:border-white/5 space-y-1 text-xs">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                          {scanResult.servant.full_name}
                        </div>
                        <div className="text-stone-600 dark:text-stone-400">
                          المرحلة: <span className="font-medium text-stone-800 dark:text-stone-200">{scanResult.servant.service_name}</span>
                        </div>
                        <div className="text-stone-600 dark:text-stone-400">
                          الدور: <span className="font-medium text-stone-800 dark:text-stone-200">{scanResult.servant.current_role}</span>
                        </div>
                        {scanResult.duration_text && (
                          <div className="text-blue-700 dark:text-blue-300 font-bold pt-1">
                            مدة التواجد: {scanResult.duration_text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-stone-400 text-xs">
                <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                وجّه الكاميرا نحو باركود كارنيه الخادم لتسجيل الحضور فوراً
              </div>
            )}
          </div>

          {/* Recent Scans List on This Device */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-sm">
            <h4 className="font-bold text-xs text-stone-700 dark:text-stone-300 mb-2 flex items-center justify-between">
              <span>سجل آخر عمليات المسح للجهاز</span>
              <span className="text-[11px] font-normal text-stone-400">({scanHistory.length})</span>
            </h4>

            {scanHistory.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">لم يتم تسجيل أي خادم حتى الآن</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-stone-800 dark:text-stone-200">
                        {item.servant?.full_name || 'خادم'}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {item.servant?.service_name} • {item.time || item.duration_text || 'اليوم'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.action_type === 'check_in'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.action_type === 'check_out'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {item.action_type === 'check_in' && 'حضور'}
                      {item.action_type === 'check_out' && 'انصراف'}
                      {item.action_type === 'duplicate_warning' && 'تكرار'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
