import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Trash2, Link as LinkIcon, Cross, Check } from 'lucide-react';

interface LogoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({
  value,
  onChange,
  label = 'شعار / لوجو الكنيسة',
  hint = 'اختر صورة الشعار من جهازك (PNG, JPG, SVG)',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');

  // Compress and resize image to lightweight Data URL (Max 400x400)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP, SVG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          onChange(dataUrl);
          setUrlInput(dataUrl);
        } else {
          const raw = e.target?.result as string;
          onChange(raw);
          setUrlInput(raw);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsUrlMode(!isUrlMode)}
          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <LinkIcon className="w-3 h-3" />
          <span>{isUrlMode ? 'اختيار ملف من الجهاز' : 'أو إدخال رابط مباشر'}</span>
        </button>
      </div>

      {isUrlMode ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="https://... رابط صورة الشعار"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              onChange(e.target.value);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
          />
          {urlInput && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-stone-200 dark:border-stone-700 cursor-pointer"
              title="إزالة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative rounded-2xl border-2 border-dashed p-3 transition-all cursor-pointer flex items-center gap-3 ${
            isDragging
              ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/30'
              : value
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20'
              : 'border-stone-300 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Logo Thumbnail Preview */}
          <div className="w-12 h-12 rounded-full border-2 border-amber-600/80 overflow-hidden bg-white dark:bg-stone-900 shadow-xs shrink-0 flex items-center justify-center">
            {value ? (
              <img
                src={value}
                alt="شعار الكنيسة"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Cross className="w-6 h-6 text-amber-600/60" />
            )}
          </div>

          {/* Action text */}
          <div className="flex-1 min-w-0 text-start">
            {value ? (
              <div>
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم تحديد شعار الكنيسة بنجاح</span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  انقر لتغيير الصورة أو اسحب ملفاً جديداً هنا
                </p>
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>اختر صورة الشعار من جهازك</span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  {hint}
                </p>
              </div>
            )}
          </div>

          {/* Remove button if value exists */}
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
              title="حذف اللوجو"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
