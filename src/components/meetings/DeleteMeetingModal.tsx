import React from 'react';
import { Trash2, AlertTriangle, X, Loader2, Calendar } from 'lucide-react';
import { GeneralMeeting } from '../../types/index.js';

interface DeleteMeetingModalProps {
  isOpen: boolean;
  meeting: GeneralMeeting | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export const DeleteMeetingModal: React.FC<DeleteMeetingModalProps> = ({
  isOpen,
  meeting,
  onClose,
  onConfirm,
  loading,
}) => {
  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-right">
        {/* Header Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/60">
            <Trash2 className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Warning */}
        <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
          تأكيد حذف اجتماع الخدام
        </h3>
        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
          هل أنت متأكد من رغبتك في حذف هذا الاجتماع نهائياً؟ سيتم أيضاً حذف كافة سجلات الحضور والغياب المرتبطة به.
        </p>

        {/* Meeting Box Details */}
        <div className="bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl p-3 mb-6 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>{meeting.title}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span>التاريخ: {meeting.date}</span>
            <span>المحاضر: {meeting.speaker || 'غير محدد'}</span>
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-400">
            المواعيد: {meeting.start_time} - {meeting.end_time}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحذف...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>نعم، احذف الاجتماع</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
