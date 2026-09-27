import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { extractFaceVector } from '../../utils/faceBiometrics.js';

interface FaceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enroll' | 'verify';
  onScanComplete: (vector: number[], thumbnail?: string) => Promise<void>;
  title?: string;
  subtitle?: string;
}

export const FaceScannerModal: React.FC<FaceScannerModalProps> = ({
  isOpen,
  onClose,
  mode,
  onScanComplete,
  title,
  subtitle,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('يرجى النظر مباشرة إلى الكاميرا وتثبيت الرأس داخل الإطار');
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setProgress(0);
    setIsProcessing(false);
    setStatusText('جاري تشغيل الكاميرا...');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('متصفحك لا يدعم الوصول المباشر لكاميرا الجهاز');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setStatusText('ثبّت وجهك داخل الدائرة، جاري مسح الملامح البيومترية...');
      startScanningProcess();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'تم رفض إذن الوصول للكاميرا. يرجى السماح للمتصفح بالوصول إلى الكاميرا من إعدادات الموقع.'
          : err.message || 'تعذر تشغيل كاميرا الجهاز'
      );
    }
  };

  const startScanningProcess = () => {
    let currentProgress = 0;
    const vectorsBuffer: number[][] = [];

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      const vec = extractFaceVector(videoRef.current);
      if (vec) {
        vectorsBuffer.push(vec);
        currentProgress += 15;
        setProgress(Math.min(100, currentProgress));

        if (currentProgress >= 100) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
          setIsProcessing(true);
          setStatusText(mode === 'enroll' ? 'جاري حفظ وتسجيل بصمة الوجه...' : 'جاري مطابقة بصمة الوجه...');

          // Average the captured vectors for ultra-stable descriptor
          const finalVec = averageVectors(vectorsBuffer);

          // Capture a small thumbnail for feedback
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = 120;
          thumbCanvas.height = 120;
          const tCtx = thumbCanvas.getContext('2d');
          if (tCtx && videoRef.current) {
            const minDim = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
            tCtx.drawImage(
              videoRef.current,
              (videoRef.current.videoWidth - minDim) / 2,
              (videoRef.current.videoHeight - minDim) / 2,
              minDim,
              minDim,
              0,
              0,
              120,
              120
            );
            const thumb = thumbCanvas.toDataURL('image/jpeg', 0.8);
            setCapturedThumbnail(thumb);
          }

          try {
            await onScanComplete(finalVec, capturedThumbnail || undefined);
            stopCamera();
          } catch (err: any) {
            setIsProcessing(false);
            setStatusText(err.message || 'فشل مطابقة بصمة الوجه');
            setCameraError(err.message || 'حدث خطأ أثناء فحص بصمة الوجه');
          }
        }
      }
    }, 180);
  };

  const averageVectors = (vectors: number[][]): number[] => {
    if (vectors.length === 0) return [];
    const len = vectors[0].length;
    const avg = new Array(len).fill(0);
    for (const v of vectors) {
      for (let i = 0; i < len; i++) {
        avg[i] += v[i];
      }
    }
    const count = vectors.length;
    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      avg[i] = avg[i] / count;
      sumSq += avg[i] * avg[i];
    }
    const norm = Math.sqrt(sumSq) || 1;
    return avg.map((v) => Number((v / norm).toFixed(5)));
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-stone-100 overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-100 font-serif">
                {title || (mode === 'enroll' ? 'تسجيل بصمة الوجه (Face ID)' : 'التحقق ببصمة الوجه (Face ID)')}
              </h3>
              <p className="text-xs text-stone-400">
                {subtitle || (mode === 'enroll' ? 'التقاط ملامح الوجه لحساب المدير العام' : 'مطابقة بصمة الوجه لتسجيل الدخول السريع')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Scanner View */}
        <div className="mt-5 relative z-10">
          {cameraError ? (
            <div className="py-8 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-xs text-rose-200 leading-relaxed font-medium">
                {cameraError}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة وتشغيل الكاميرا</span>
              </button>
            </div>
          ) : (
            <div className="relative w-full aspect-4/3 bg-stone-950 rounded-2xl overflow-hidden border border-stone-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Biometric Oval Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Oval Face Boundary */}
                <div className={`relative w-48 h-60 rounded-[50%] border-2 transition-colors duration-300 ${
                  progress >= 100
                    ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.5)]'
                    : 'border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                }`}>
                  {/* Corner Reticle Accents */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-400 rounded-full" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-400 rounded-full" />
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-8 w-1 bg-amber-400 rounded-full" />
                  <div className="absolute top-1/2 -right-1 -translate-y-1/2 h-8 w-1 bg-amber-400 rounded-full" />

                  {/* Animated Laser Scanning Beam */}
                  {cameraActive && !isProcessing && progress < 100 && (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#fbbf24] animate-pulse top-1/3" />
                  )}

                  {/* Complete Check */}
                  {progress >= 100 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-stone-950/40 rounded-[50%] backdrop-blur-xs">
                      <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="absolute bottom-3 inset-x-4">
                <div className="bg-stone-900/90 backdrop-blur-md rounded-xl p-2.5 border border-stone-700/60 shadow-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-stone-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {statusText}
                    </span>
                    <span className="text-amber-400 font-mono">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        progress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-600 to-amber-400'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-stone-800 flex items-center justify-between text-xs relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            إلغاء والرجوع
          </button>

          <span className="text-[11px] text-stone-500">
            تشفير بيومتري محلي آمن ومحمي
          </span>
        </div>
      </div>
    </div>
  );
};
