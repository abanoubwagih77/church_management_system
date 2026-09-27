import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { GeneralMeeting } from '../../types/index.js';
import { PrintAttendanceModal } from './PrintAttendanceModal.js';
import { DeleteMeetingModal } from './DeleteMeetingModal.js';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Printer,
  Download,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Mic2,
  Trash2,
  Edit,
  Edit2,
  X,
  AlertCircle,
  Sparkles,
  QrCode,
  Cross,
  RefreshCw,
} from 'lucide-react';

interface MeetingRosterItem {
  servant_id: string;
  servant_name: string;
  servant_phone: string;
  service_id?: string;
  service_name?: string;
  current_role?: string;
  status: 'present' | 'completed' | 'late_absent' | 'absent' | 'priest_exempt';
  is_late?: boolean;
  is_priest?: boolean;
  check_in_time: string; // Formatted Arabic string e.g. 12:15 م
  check_in_time_raw?: string | null;
  check_out_time: string;
  duration_minutes?: number;
  scanner_device_name?: string;
  notes?: string;
}

interface MeetingDetailsResponse {
  success: boolean;
  meeting: GeneralMeeting;
  stats: {
    total_eligible: number;
    present: number;
    late_absent: number;
    absent: number;
    total_absent: number;
    attendance_percentage: number;
    priests_count: number;
  };
  roster: MeetingRosterItem[];
}

export const MeetingsManager: React.FC<{ onNavigateToScanner?: () => void }> = ({
  onNavigateToScanner,
}) => {
  const { user, church, hasPermission } = useAuth();
  const { t, language } = useLanguage();

  const [meetings, setMeetings] = useState<GeneralMeeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsResponse | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Edit Meeting State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [editFormError, setEditFormError] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSpeaker, setEditSpeaker] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('12:00');
  const [editEndTime, setEditEndTime] = useState<string>('14:00');
  const [editCutoffTime, setEditCutoffTime] = useState<string>('13:00');
  const [editNotes, setEditNotes] = useState<string>('');

  // Form Fields
  const [title, setTitle] = useState<string>('');
  const [speaker, setSpeaker] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('12:00');
  const [endTime, setEndTime] = useState<string>('14:00');
  const [cutoffTime, setCutoffTime] = useState<string>('13:00');
  const [notes, setNotes] = useState<string>('');

  // Table Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late_absent' | 'absent' | 'priest'>('all');

  // Modals for Delete & Print
  const [meetingToDelete, setMeetingToDelete] = useState<GeneralMeeting | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Load all meetings
  const loadMeetings = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get<{ success: boolean; meetings: GeneralMeeting[] }>('/api/meetings');
      const list = Array.isArray(res?.meetings) ? res.meetings : [];
      setMeetings(list);
      // Automatically select the latest meeting if none selected or selected not in list
      if (list.length > 0) {
        setSelectedMeetingId((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0].id));
      }
    } catch (err) {
      console.error('Error loading meetings:', err);
      setMeetings([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Load details for selected meeting
  const loadMeetingDetails = useCallback(async (id: string) => {
    try {
      setLoadingDetails(true);
      const res = await api.get<MeetingDetailsResponse>(`/api/meetings/${id}`);
      if (res && res.success && res.meeting) {
        setMeetingDetails({
          ...res,
          roster: Array.isArray(res.roster) ? res.roster : [],
        });
      }
    } catch (err) {
      console.error('Error loading meeting details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMeetingId) {
      loadMeetingDetails(selectedMeetingId);
    }
  }, [selectedMeetingId, loadMeetingDetails]);

  // Open Edit Meeting Modal with current values
  const openEditModal = (meeting: GeneralMeeting) => {
    setEditTitle(meeting.title || '');
    setEditSpeaker(meeting.speaker || '');
    setEditDate(meeting.date || '');
    setEditStartTime(meeting.start_time || '12:00');
    setEditEndTime(meeting.end_time || '14:00');
    setEditCutoffTime(meeting.late_cutoff_time || '13:00');
    setEditNotes(meeting.notes || '');
    setEditFormError('');
    setShowEditModal(true);
  };

  // Handle Edit Meeting Submit
  const handleUpdateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId) return;
    setEditFormError('');

    if (!editTitle.trim()) {
      setEditFormError('يرجى إدخال عنوان الاجتماع أو موضوع الكلمة');
      return;
    }
    if (!editSpeaker.trim()) {
      setEditFormError('يرجى إدخال اسم المحاضر / المتكلم');
      return;
    }

    try {
      setEditing(true);
      const res = await api.put<{ success: boolean; meeting: GeneralMeeting }>(`/api/meetings/${selectedMeetingId}`, {
        title: editTitle.trim(),
        speaker: editSpeaker.trim(),
        date: editDate,
        start_time: editStartTime,
        end_time: editEndTime,
        late_cutoff_time: editCutoffTime,
        notes: editNotes.trim(),
      });

      if (res.success) {
        setShowEditModal(false);
        await loadMeetings();
        await loadMeetingDetails(selectedMeetingId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تعديل موعد الاجتماع';
      setEditFormError(msg);
    } finally {
      setEditing(false);
    }
  };

  // Handle Create Meeting Submit
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('يرجى إدخال عنوان الاجتماع أو موضوع الكلمة');
      return;
    }
    if (!speaker.trim()) {
      setFormError('يرجى إدخال اسم المحاضر / المتكلم في اليوم');
      return;
    }

    try {
      setCreating(true);
      const res = await api.post<{ success: boolean; meeting: GeneralMeeting }>('/api/meetings', {
        title: title.trim(),
        speaker: speaker.trim(),
        date,
        start_time: startTime,
        end_time: endTime,
        late_cutoff_time: cutoffTime,
        notes: notes.trim(),
      });

      if (res.success) {
        setShowCreateModal(false);
        setTitle('');
        setSpeaker('');
        setNotes('');
        await loadMeetings();
        setSelectedMeetingId(res.meeting.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إنشاء الاجتماع';
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  };

  // Handle Delete Meeting Confirm
  const handleConfirmDelete = async () => {
    if (!meetingToDelete) return;

    try {
      setIsDeleting(true);
      const targetId = meetingToDelete.id;
      await api.delete(`/api/meetings/${targetId}`);

      setMeetings((prev) => prev.filter((m) => m.id !== targetId));

      if (selectedMeetingId === targetId) {
        setSelectedMeetingId(null);
        setMeetingDetails(null);
      }
      setMeetingToDelete(null);
      await loadMeetings();
    } catch (err: unknown) {
      console.error('Failed to delete meeting:', err);
      // Even if network error, local persistence handles it
      const targetId = meetingToDelete.id;
      setMeetings((prev) => prev.filter((m) => m.id !== targetId));
      if (selectedMeetingId === targetId) {
        setSelectedMeetingId(null);
        setMeetingDetails(null);
      }
      setMeetingToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter roster items
  const filteredRoster = (meetingDetails?.roster || []).filter((item) => {
    // Status filter
    if (statusFilter === 'present') {
      if (item.status !== 'present' && item.status !== 'completed') return false;
    } else if (statusFilter === 'late_absent') {
      if (item.status !== 'late_absent') return false;
    } else if (statusFilter === 'absent') {
      if (item.status !== 'absent') return false;
    } else if (statusFilter === 'priest') {
      if (!item.is_priest) return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.servant_name.toLowerCase().includes(q);
      const matchPhone = item.servant_phone.includes(q);
      const matchService = (item.service_name || '').toLowerCase().includes(q);
      const matchRole = (item.current_role || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchService || matchRole;
    }

    return true;
  });

  // Print attendance sheet
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!meetingDetails) return;
    const meeting = meetingDetails.meeting;
    const rows = [
      ['كنيسة الشهيد العظيم مارجرجس بمنية شبين القناطر'],
      [`كشف حضور اجتماع الخدام: ${meeting.title}`],
      [`المحاضر: ${meeting.speaker}`, `التاريخ: ${meeting.date}`, `الموعد: من ${meeting.start_time} إلى ${meeting.end_time}`, `آخر موعد حضور: ${meeting.late_cutoff_time}`],
      [],
      ['م', 'اسم الخادم', 'رقم الهاتف', 'الخدمة / المرحلة', 'الرتبة الكنسية', 'حالة الحضور', 'وقت الحضور', 'وقت الانصراف', 'مدة التواجد', 'جهاز التسجيل'],
    ];

    filteredRoster.forEach((r, idx) => {
      let statusText = 'غياب';
      if (r.is_priest) statusText = 'أب كاهن (معفى)';
      else if (r.status === 'present' || r.status === 'completed') statusText = 'حاضر في الموعد';
      else if (r.status === 'late_absent') statusText = 'غياب (تأخر بعد الموعد)';

      rows.push([
        String(idx + 1),
        r.servant_name,
        r.servant_phone,
        r.service_name || '',
        r.current_role || '',
        statusText,
        r.check_in_time || '—',
        r.check_out_time || '—',
        r.duration_minutes ? `${r.duration_minutes} دقيقة` : '—',
        r.scanner_device_name || '—',
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.map((c) => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `حضور_اجتماع_${meeting.date}_${meeting.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>اجتماعات الخدام العامة</span>
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              ربط الحضور والغياب بمواعيد الاجتماع والمحاضرات
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
            إدارة كشوف واجتماعات الخدام
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            سجل دقيق لمواعيد حضور وانصراف الخدام، تطبيق قاعدة الغياب بعد الموعد المحدد، واستثناء الآباء الكهنة.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onNavigateToScanner && (
            <button
              id="btn-nav-scanner-from-meetings"
              type="button"
              onClick={onNavigateToScanner}
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <QrCode className="w-4 h-4 text-amber-600" />
              <span>فتح السكانر (QR)</span>
            </button>
          )}

          {hasPermission('add_attendance', 'full_access') && (
            <button
              id="btn-open-create-meeting-modal"
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء اجتماع جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Meetings Selector Strip */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>اختر الاجتماع لعرض كشف الحضور والغياب:</span>
          </h3>
          <button
            type="button"
            onClick={loadMeetings}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-xs transition-colors"
            title="تحديث الاجتماعات"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingList ? (
          <div className="py-4 text-center text-xs text-stone-400">جاري تحميل قائمة الاجتماعات...</div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
            <Calendar className="w-8 h-8 text-stone-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2">
              لم يتم إنشاء أي اجتماعات خدام حتى الآن
            </p>
            <p className="text-[11px] text-stone-500 mb-3">
              (ملاحظة: عند عمل سكان لأول خادم في يوم الاجتماع، سيقوم السيستم بإنشاء اجتماع تلقائي لليوم)
            </p>
            {hasPermission('add_attendance', 'full_access') && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                + إنشاء أول اجتماع للخدام
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {meetings.map((m) => {
              const isSelected = m.id === selectedMeetingId;
              const isToday = m.date === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={`group relative shrink-0 text-right p-3 rounded-xl border transition-all cursor-pointer min-w-[200px] max-w-[260px] ${
                    isSelected
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                      : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      {m.date}
                    </span>
                    <div className="flex items-center gap-1">
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          اجتماع اليوم
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMeetingToDelete(m);
                        }}
                        className="opacity-60 group-hover:opacity-100 p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
                        title="حذف هذا الاجتماع"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="font-bold text-xs text-stone-900 dark:text-white truncate">
                    {m.title}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                    المحاضر: {m.speaker}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-2 pt-1.5 border-t border-stone-200/60 dark:border-stone-700/60">
                    <span>{m.start_time} - {m.end_time}</span>
                    <span>•</span>
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      آخر حضور: {m.late_cutoff_time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Meeting Details & Roster */}
      {selectedMeetingId && meetingDetails && (
        <div className="space-y-6">
          {/* Meeting Overview Card */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <div className="flex items-center gap-2 mb-1 text-xs text-amber-700 dark:text-amber-400 font-bold">
                  <Calendar className="w-4 h-4" />
                  <span>تاريخ الاجتماع: {meetingDetails.meeting.date}</span>
                  <span>•</span>
                  <span>من {meetingDetails.meeting.start_time} إلى {meetingDetails.meeting.end_time}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-serif">
                  {meetingDetails.meeting.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-300 mt-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <Mic2 className="w-3.5 h-3.5 text-amber-600" />
                    المحاضر / المتكلم: <strong className="text-stone-900 dark:text-white">{meetingDetails.meeting.speaker}</strong>
                  </span>
                  <span className="text-stone-300 dark:text-stone-700">|</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800">
                    آخر موعد مسموح به للحضور: {meetingDetails.meeting.late_cutoff_time} (بعده يُسجل غياب)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {hasPermission('edit_attendance', 'full_access') && (
                  <button
                    type="button"
                    onClick={() => openEditModal(meetingDetails.meeting)}
                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="تعديل موعد الاجتماع وآخر ميعاد للحضور"
                  >
                    <Edit2 className="w-4 h-4 text-amber-600" />
                    <span>تعديل المواعيد ووقت الغياب</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="طباعة كشف الحضور الرسمي"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الكشف</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="تصدير ملف إكسيل"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">تصدير Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingToDelete(meetingDetails.meeting)}
                  className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="حذف هذا الاجتماع"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف الاجتماع</span>
                </button>
              </div>
            </div>

            {/* Statistics Dashboard Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
              <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-200 dark:border-stone-800 text-center">
                <span className="block text-[11px] text-stone-500 dark:text-stone-400 font-semibold mb-0.5">
                  إجمالي الخدام
                </span>
                <span className="text-xl font-bold text-stone-900 dark:text-white">
                  {meetingDetails.stats.total_eligible}
                </span>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-center">
                <span className="block text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mb-0.5 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  حاضر في الموعد
                </span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {meetingDetails.stats.present}
                </span>
              </div>

              <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 text-center">
                <span className="block text-[11px] text-rose-700 dark:text-rose-300 font-semibold mb-0.5 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  غياب بعد الموعد
                </span>
                <span className="text-xl font-bold text-rose-700 dark:text-rose-400">
                  {meetingDetails.stats.late_absent}
                </span>
              </div>

              <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-800/60 text-center">
                <span className="block text-[11px] text-red-700 dark:text-red-300 font-semibold mb-0.5 flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  غياب لم يسجل
                </span>
                <span className="text-xl font-bold text-red-700 dark:text-red-400">
                  {meetingDetails.stats.absent}
                </span>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-center">
                <span className="block text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold mb-0.5 flex items-center justify-center gap-1">
                  <Cross className="w-3.5 h-3.5" />
                  آباء كهنة
                </span>
                <span className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                  {meetingDetails.stats.priests_count}
                </span>
                <span className="block text-[9px] text-indigo-600 dark:text-indigo-400 font-medium">
                  معفى من الحضور
                </span>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 text-center">
                <span className="block text-[11px] text-amber-700 dark:text-amber-300 font-semibold mb-0.5">
                  نسبة الحضور
                </span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
                  %{meetingDetails.stats.attendance_percentage}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Attendance Roster Table */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Table Filters & Search */}
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم الخادم، التليفون، المرحلة..."
                  className="w-full pr-9 pl-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  الكل ({meetingDetails.roster.length})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('present')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'present'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  حاضر في الموعد ({meetingDetails.stats.present})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('late_absent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'late_absent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                  }`}
                >
                  غياب بعد الموعد ({meetingDetails.stats.late_absent})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('absent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'absent'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100'
                  }`}
                >
                  غياب لم يسجل ({meetingDetails.stats.absent})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('priest')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'priest'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                  }`}
                >
                  آباء كهنة ({meetingDetails.stats.priests_count})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/70 border-b border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 font-bold">
                    <th className="py-3 px-4 w-12 text-center">م</th>
                    <th className="py-3 px-4">الخادم / المسؤول</th>
                    <th className="py-3 px-4">المرحلة / الخدمة</th>
                    <th className="py-3 px-4">الرتبة الكنسية</th>
                    <th className="py-3 px-4">حالة الحضور</th>
                    <th className="py-3 px-4">وقت الحضور</th>
                    <th className="py-3 px-4">وقت الانصراف</th>
                    <th className="py-3 px-4">مدة التواجد</th>
                    <th className="py-3 px-4">جهاز التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  {loadingDetails ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-stone-400">
                        جاري تحميل كشف الحضور...
                      </td>
                    </tr>
                  ) : filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-stone-400">
                        لا توجد نتائج تطابق معايير البحث
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((row, idx) => (
                      <tr
                        key={row.servant_id}
                        className={`hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors ${
                          row.is_priest ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-mono text-stone-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                            {row.is_priest && <Cross className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                            <span>{row.servant_name}</span>
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                            {row.servant_phone}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-stone-700 dark:text-stone-300 font-medium">
                          {row.service_name || 'غير محدد'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                            {row.current_role || (row.is_priest ? 'أب كاهن' : 'خادم')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {row.is_priest ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <Cross className="w-3 h-3" />
                              أب كاهن (معفى)
                            </span>
                          ) : row.status === 'present' || row.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              حاضر في الموعد
                            </span>
                          ) : row.status === 'late_absent' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="تجاوز آخر موعد مسموح به للحضور">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              غياب (تأخر بعد الموعد)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                              <XCircle className="w-3 h-3" />
                              غياب (لم يحضر)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-800 dark:text-stone-200">
                          {row.check_in_time || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-700 dark:text-stone-300">
                          {row.check_out_time ? (
                            row.check_out_time
                          ) : row.check_in_time ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                              داخل الاجتماع
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-stone-600 dark:text-stone-400">
                          {row.duration_minutes !== undefined ? (
                            <span className="font-bold text-blue-700 dark:text-blue-300">
                              {Math.floor(row.duration_minutes / 60) > 0
                                ? `${Math.floor(row.duration_minutes / 60)} س و${row.duration_minutes % 60} د`
                                : `${row.duration_minutes} دقيقة`}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-500 dark:text-stone-400 text-[11px]">
                          {row.scanner_device_name || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="p-4 bg-stone-50 dark:bg-stone-800/40 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-2">
              <div>
                إجمالي المعروض: <strong className="text-stone-900 dark:text-white">{filteredRoster.length}</strong> خادم
              </div>
              <div className="text-[11px] text-stone-400">
                يتم تحديث الكشف تلقائياً بمجرد مسح أي خادم لباركود الكارنيه بواسطة أجهزة السكانر المعتمدة.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Meeting */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50 shrink-0">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <span>إنشاء اجتماع خدام جديد</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  تحديد موعد الاجتماع، المحاضر، وموعد إغلاق الحضور للغياب التلقائي
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateMeeting} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              {/* Title / Topic */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  عنوان الاجتماع / موضوع الكلمة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تدبير الخدمة والافتقاد / حياة الصلاة في حياة الخادم"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Speaker */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  اسم المحاضر / المتكلم في اليوم <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  placeholder="مثال: قدس أبونا بيشوي / الشماس فلان / دكتور مجدي"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تاريخ الاجتماع <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Times Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    وقت بدء الاجتماع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    وقت انتهاء الاجتماع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Late Cutoff Time Field (Crucial requirement from user) */}
              <div className="bg-amber-50/80 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-1.5">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                  آخر موعد مسموح به لتسجيل الحضور (Cut-off Time) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pt-1">
                  ⚠️ <strong>قاعدة الغياب التلقائي:</strong> أي خادم يقوم بمسح الكود <strong>بعد هذا الوقت المحدد</strong> (مثلاً بعد الساعة 01:00 م) سيتم تسجيله تلقائياً كـ <strong>"غياب لتجاوز الموعد"</strong>.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تنبيهات أو توجيهات خاصة بالاجتماع..."
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-stone-900 pb-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {creating ? 'جاري الحفظ...' : 'حفظ وإنشاء الاجتماع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Meeting Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    تعديل بيانات الاجتماع وموعد الغياب
                  </h3>
                  <p className="text-xs text-stone-500">
                    يمكنك تعديل وقت الحضور ووقت الغياب التلقائي (Cut-off Time)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleUpdateMeeting} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {editFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}

              {/* Title & Subject */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  موضوع الكلمة / عنوان الاجتماع <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="مثال: أهمية الصلاة في حياة الخادم"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Speaker */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  المحاضر / المتكلم في اليوم <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSpeaker}
                  onChange={(e) => setEditSpeaker(e.target.value)}
                  placeholder="مثال: أبونا مرقس / أ. مينا عاطف"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تاريخ الاجتماع <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Times Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    وقت بدء الاجتماع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    وقت انتهاء الاجتماع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Late Cutoff Time Field */}
              <div className="bg-amber-50/90 dark:bg-amber-950/50 p-4 rounded-xl border border-amber-300 dark:border-amber-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                    آخر موعد مسموح به لتسجيل الحضور (Cut-off Time) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                    الموعد الحالي: {editCutoffTime}
                  </span>
                </div>
                <input
                  type="time"
                  required
                  value={editCutoffTime}
                  onChange={(e) => setEditCutoffTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-amber-400 dark:border-amber-600 rounded-xl text-sm font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pt-1">
                  ⏱️ <strong>تعديل وقت الغياب:</strong> يمكنك ضبط الموعد بدقة (مثلاً 01:15 م أو 01:30 م). أي عملية مسح QR تتم بعد هذا الوقت ستعتبر <strong>غياب تأخير</strong>.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="أي تنبيهات أو توجيهات خاصة بالاجتماع..."
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-stone-900 pb-1">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {editing ? 'جاري التعديل...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Meeting Confirmation Modal */}
      <DeleteMeetingModal
        isOpen={Boolean(meetingToDelete)}
        meeting={meetingToDelete}
        onClose={() => setMeetingToDelete(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
      />

      {/* Official Print Attendance Sheet Modal */}
      <PrintAttendanceModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={meetingDetails}
      />
    </div>
  );
};
