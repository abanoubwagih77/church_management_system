import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Cross, Phone, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Church } from '../../types/index.js';

interface ServantBadgeProps {
  servant: {
    id: string;
    full_name: string;
    phone: string;
    national_id?: string;
    profile_photo?: string;
    current_role?: string;
    current_service_id?: string;
    service_name?: string;
    blood_type?: string;
    church_id?: string;
  };
  church?: Church | null;
  serviceName?: string;
  id?: string;
  className?: string;
  printMode?: boolean;
}

export const ServantBadgeCard: React.FC<ServantBadgeProps> = ({
  servant,
  church,
  serviceName,
  id,
  className = '',
  printMode = false,
}) => {
  const { church: authChurch } = useAuth();
  const activeChurch = church || authChurch;

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const displayServiceName =
    serviceName || servant.service_name || 'الخدمة العامة';

  // Format short display code (e.g. SRV-042)
  const shortCode = `SRV-${servant.id.replace(/\D/g, '').slice(-4) || '2026'}`;

  // Church dynamic metadata
  const churchName = activeChurch?.name || 'كنيسة معتمدة';
  const diocese = activeChurch?.diocese || 'الكنيسة القبطية الأرثوذكسية';
  const logoUrl = activeChurch?.logo_url || activeChurch?.branding?.logo_url;
  const blessingText = 'بركة المسيح تكون معكم';

  useEffect(() => {
    let isMounted = true;

    // Encode JSON with servant_id and metadata for maximum compatibility
    const qrPayload = JSON.stringify({
      servant_id: servant.id,
      name: servant.full_name,
      phone: servant.phone,
      church: activeChurch?.name || activeChurch?.id || 'church',
    });

    QRCode.toDataURL(qrPayload, {
      width: printMode ? 320 : 200,
      margin: 1,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeUrl(url);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code for servant badge:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [servant.id, servant.full_name, servant.phone, activeChurch?.name, activeChurch?.id, printMode]);

  return (
    <div
      id={id}
      className={`servant-id-card relative w-[310px] sm:w-[330px] rounded-3xl overflow-hidden shadow-xl border-2 border-amber-500/80 bg-gradient-to-b from-stone-900 via-amber-950 to-stone-950 text-white font-sans transition-all select-none ${className}`}
      style={{
        boxShadow: '0 12px 35px -8px rgba(180, 83, 9, 0.3)',
      }}
    >
      {/* Decorative Gold Header Top Bar */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 py-1 px-3 flex items-center justify-between text-[11px] font-bold text-stone-950 tracking-wider">
        <span className="flex items-center gap-1 font-serif truncate max-w-[220px]">
          <Cross className="w-3 h-3 fill-stone-950 shrink-0" />
          <span className="truncate">{diocese}</span>
        </span>
        <span className="px-1.5 py-0.2 bg-stone-950/20 rounded-sm text-[10px] shrink-0 font-mono">
          2026م
        </span>
      </div>

      {/* Church Branding Header */}
      <div className="pt-3.5 pb-2.5 px-4 text-center relative border-b border-amber-500/30">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-400/90 shadow-sm shrink-0 bg-stone-800 flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={churchName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Cross className="w-4 h-4 text-yellow-400" />
            )}
          </div>
          <div className="text-right flex-1 min-w-0 pr-1 flex flex-col justify-center">
            <h2 className="text-xs sm:text-sm font-extrabold text-amber-300 font-serif leading-snug truncate">
              {churchName}
            </h2>
            {activeChurch?.address && (
              <p className="text-[11px] sm:text-xs text-stone-200 font-medium leading-normal mt-1 block truncate">
                {activeChurch.address}
              </p>
            )}
          </div>
        </div>

        {/* Badge Title Ribbon */}
        <div className="mt-1.5 inline-block px-3.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[11px] font-bold text-yellow-300 shadow-xs">
          كارنيه خادم معتمد
        </div>
      </div>

      {/* Main Body: Servant Details & Photo */}
      <div className="p-4 flex flex-col items-center text-center">
        {/* Photo Container */}
        <div className="relative mb-2.5">
          <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-yellow-400 bg-stone-800 shadow-md flex items-center justify-center">
            {servant.profile_photo ? (
              <img
                src={servant.profile_photo}
                alt={servant.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-stone-400">
                <User className="w-9 h-9 text-yellow-500/70" />
                <span className="text-[9px] mt-0.5 text-stone-400">صورة خادم</span>
              </div>
            )}
          </div>
          <div className="absolute -bottom-1.5 -start-1.5 bg-yellow-500 text-stone-950 p-1 rounded-full border border-stone-900 shadow-xs" title="خادم معتمد">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Servant Name */}
        <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug tracking-tight px-1 font-serif">
          {servant.full_name}
        </h3>

        {/* Service Stage Badge */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/30 border border-amber-400/60 text-yellow-200 text-xs font-bold">
            {displayServiceName}
          </span>
          {servant.current_role && (
            <span className="px-2 py-0.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-200 text-[11px] font-semibold">
              {servant.current_role}
            </span>
          )}
        </div>

        {/* Phone & ID Code */}
        <div className="mt-2.5 w-full bg-stone-900/80 rounded-xl p-2 border border-stone-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-stone-300 font-mono" dir="ltr">
            <Phone className="w-3.5 h-3.5 text-amber-400" />
            <span>{servant.phone}</span>
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
            {shortCode}
          </span>
        </div>

        {/* QR Code Section */}
        <div className="mt-3 w-full flex flex-col items-center justify-center bg-white text-stone-900 rounded-2xl p-2.5 shadow-inner">
          <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt={`QR Code ${servant.full_name}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">
                جاري إنشاء الباركود...
              </div>
            )}
          </div>
          <div className="mt-1 text-[10px] font-bold text-stone-800 text-center flex items-center justify-center gap-1">
            <span>امسح الكود لتسجيل الحضور والانصراف</span>
          </div>
          <div className="text-[9px] text-amber-800 font-semibold">
            اجتماع الخدام العام
          </div>
        </div>
      </div>

      {/* Footer / Official Seal Note */}
      <div className="bg-stone-950/90 py-1.5 px-4 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-stone-300">
        <span className="flex items-center gap-1.5 text-stone-300 font-medium">
          <Cross className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          <span>{blessingText}</span>
          <Cross className="w-2.5 h-2.5 text-amber-400 shrink-0" />
        </span>
        <span className="font-serif text-amber-400/90 font-bold shrink-0">
          أمانة الخدمة
        </span>
      </div>
    </div>
  );
};
