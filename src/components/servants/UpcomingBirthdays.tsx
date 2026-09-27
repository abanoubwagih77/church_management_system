import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { Servant, ChurchService } from '../../types/index.js';
import {
  Cake,
  Calendar,
  Phone,
  MessageCircle,
  Search,
  Filter,
  Users,
  Sparkles,
  ChevronLeft,
  PartyPopper,
  Clock,
  RefreshCw,
  Check,
  Send,
  ExternalLink,
  X,
  Heart,
  UserCheck,
  Share2,
} from 'lucide-react';

interface BirthdayServant extends Servant {
  daysUntilBirthday: number;
  nextBirthdayDate: Date;
  nextAge: number;
  formattedBirthday: string;
  service_name?: string;
}

export type BirthdayFilter = 'today' | 'this_week' | 'this_month' | 'next30' | 'all';

export const UpcomingBirthdays: React.FC = () => {
  const { church } = useAuth();
  const [servants, setServants] = useState<Servant[]>([]);
  const [services, setServices] = useState<ChurchService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<BirthdayFilter>('today');

  // Bulk WhatsApp Modal state
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [sentServantIds, setSentServantIds] = useState<Set<string>>(new Set());
  const [bulkAlert, setBulkAlert] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servantsRes, servicesRes] = await Promise.all([
        api.get<{ success: boolean; servants: Servant[] }>('/api/servants'),
        api.get<{ success: boolean; services: ChurchService[] }>('/api/services'),
      ]);

      if (servantsRes && servantsRes.servants) {
        setServants(servantsRes.servants);
      }
      if (servicesRes && servicesRes.services) {
        setServices(servicesRes.services);
      }
    } catch (err) {
      console.error('Failed to load birthdays data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute upcoming birthdays
  const birthdayServants: BirthdayServant[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    const list: BirthdayServant[] = [];

    servants.forEach((s) => {
      if (!s.date_of_birth) return;
      const dob = new Date(s.date_of_birth);
      if (isNaN(dob.getTime())) return;

      const birthMonth = dob.getMonth(); // 0-indexed
      const birthDay = dob.getDate();
      const birthYear = dob.getFullYear();

      // Determine next birthday
      let nextBirthday = new Date(currentYear, birthMonth, birthDay);
      nextBirthday.setHours(0, 0, 0, 0);

      // If already passed this year, next birthday is next year
      if (nextBirthday.getTime() < today.getTime()) {
        nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
      }

      const diffTime = nextBirthday.getTime() - today.getTime();
      const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const nextAge = nextBirthday.getFullYear() - birthYear;

      const formatted = nextBirthday.toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'long',
      });

      const srvName =
        services.find((sv) => sv.id === s.current_service_id)?.name_ar || (s as any).service_name || '';

      list.push({
        ...s,
        daysUntilBirthday: daysUntil,
        nextBirthdayDate: nextBirthday,
        nextAge,
        formattedBirthday: formatted,
        service_name: srvName,
      });
    });

    // Sort ascending by days until birthday
    return list.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
  }, [servants, services]);

  // Servants with birthday today
  const todayServants = useMemo(() => {
    return birthdayServants.filter((s) => s.daysUntilBirthday === 0);
  }, [birthdayServants]);

  // Filtered list
  const filteredList = useMemo(() => {
    return birthdayServants.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.full_name?.toLowerCase().includes(q);
        const matchPhone = item.phone?.includes(q);
        const matchService = (item.service_name || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchService) return false;
      }

      // Service Filter
      if (selectedServiceId !== 'all') {
        const srvId = item.current_service_id || (item as any).service_id;
        if (srvId !== selectedServiceId) return false;
      }

      // Time Range Filter
      if (activeFilter === 'today') {
        return item.daysUntilBirthday === 0;
      } else if (activeFilter === 'this_week') {
        return item.daysUntilBirthday <= 7;
      } else if (activeFilter === 'this_month') {
        const today = new Date();
        return (
          item.nextBirthdayDate.getMonth() === today.getMonth() &&
          item.nextBirthdayDate.getFullYear() === today.getFullYear()
        );
      } else if (activeFilter === 'next30') {
        return item.daysUntilBirthday <= 30;
      }

      return true;
    });
  }, [birthdayServants, searchQuery, selectedServiceId, activeFilter]);

  // Statistics
  const todayBirthdaysCount = todayServants.length;
  const weekBirthdaysCount = birthdayServants.filter((s) => s.daysUntilBirthday <= 7).length;
  const monthBirthdaysCount = birthdayServants.filter((s) => {
    const today = new Date();
    return s.nextBirthdayDate.getMonth() === today.getMonth() && s.nextBirthdayDate.getFullYear() === today.getFullYear();
  }).length;

  // Build personalized WhatsApp greeting message
  const getBirthdayMessage = (servant: BirthdayServant) => {
    const churchName = church?.name?.trim() || 'كنيستنا المباركة';

    let bishopPhrase = '';
    if (church?.bishop_name?.trim()) {
      const rawBishop = church.bishop_name.trim();
      const normalized = rawBishop.startsWith('نيافة') ? rawBishop : `نيافة ${rawBishop}`;
      bishopPhrase = ` و${normalized}`;
    } else if (church?.diocese?.trim()) {
      const rawDiocese = church.diocese.trim();
      const normalizedDiocese = rawDiocese.startsWith('إيبارشية') ? rawDiocese : `إيبارشية ${rawDiocese}`;
      bishopPhrase = ` ونيافة مطران/أسقف ${normalizedDiocese}`;
    }

    return `كل سنة وأنت طيب وبخير يا خادم المسيح ${servant.full_name} بمناسبة عيد ميلادك المبارك! 🎉🎂
بصلوات قداسة البابا تواضروس الثاني${bishopPhrase}، بنصلي لربنا يديم خدمتك ومحبتك ويبارك حياتك في ${churchName} ✝️✨`;
  };

  const handleSendWhatsApp = (servant: BirthdayServant) => {
    const cleanPhone = servant.phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    const message = getBirthdayMessage(servant);
    const url = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setSentServantIds((prev) => new Set([...prev, servant.id]));
  };

  const handleBulkWhatsAppClick = () => {
    if (todayServants.length === 0) {
      setBulkAlert('لا توجد أعياد ميلاد مسجلة لهذا اليوم لإرسال المعايدات.');
      setTimeout(() => setBulkAlert(null), 4000);
      return;
    }
    if (todayServants.length === 1) {
      handleSendWhatsApp(todayServants[0]);
      return;
    }
    setShowBulkModal(true);
  };

  // Next unsent servant for quick guided sending
  const nextUnsentServant = useMemo(() => {
    return todayServants.find((s) => !sentServantIds.has(s.id));
  }, [todayServants, sentServantIds]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-amber-50 mb-2 border border-white/30">
              <PartyPopper className="w-4 h-4" />
              <span>متابعة ورعاية الخدام ومحبتهم</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif">
              أعياد ميلاد الخدام 🎉
            </h1>
            <p className="text-amber-100 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              كشف بمواعيد أعياد ميلاد الخدام والخادمات لإرسال المعايدات والمباركة الفردية أو الجماعية لهم في أيامهم الخاصة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Button to send bulk WhatsApp greetings to everyone celebrating today */}
            <button
              type="button"
              onClick={handleBulkWhatsAppClick}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                todayBirthdaysCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                  : 'bg-white/20 text-white/80 hover:bg-white/30'
              }`}
              title="إرسال رسائل معايدة واتساب لكافة خدام اليوم"
            >
              <MessageCircle className="w-4 h-4" />
              <span>
                {todayBirthdaysCount > 0
                  ? `إرسال معايدات اليوم للجميع (${todayBirthdaysCount})`
                  : 'معايدات اليوم عبر واتساب'}
              </span>
            </button>

            <button
              type="button"
              onClick={fetchData}
              className="px-4 py-2.5 rounded-xl bg-white text-amber-900 hover:bg-amber-50 text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث القائمة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Alert Notice */}
      {bulkAlert && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          <span>{bulkAlert}</span>
        </div>
      )}

      {/* Summary KPI Cards - Clickable to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveFilter('today')}
          className={`p-4 rounded-2xl shadow-xs text-center relative overflow-hidden transition-all cursor-pointer text-start ${
            activeFilter === 'today'
              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800'
              : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-rose-300'
          }`}
        >
          <div className="absolute top-0 right-0 left-0 h-1 bg-rose-500" />
          <span className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
            أعياد ميلاد اليوم 🎂
          </span>
          <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {todayBirthdaysCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('this_week')}
          className={`p-4 rounded-2xl shadow-xs text-center relative overflow-hidden transition-all cursor-pointer text-start ${
            activeFilter === 'this_week'
              ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800'
              : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-300'
          }`}
        >
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <span className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
            خلال هذا الأسبوع 📅
          </span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {weekBirthdaysCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('this_month')}
          className={`p-4 rounded-2xl shadow-xs text-center relative overflow-hidden transition-all cursor-pointer text-start ${
            activeFilter === 'this_month'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800'
              : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <span className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
            خلال هذا الشهر 🎈
          </span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {monthBirthdaysCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-2xl shadow-xs text-center relative overflow-hidden transition-all cursor-pointer text-start ${
            activeFilter === 'all'
              ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800'
              : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-blue-300'
          }`}
        >
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-500" />
          <span className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
            خدام مسجل ميلادهم 👥
          </span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {birthdayServants.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Quick Date Filters with dedicated 'اليوم' tab */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'today'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <span>اليوم</span>
              {todayBirthdaysCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeFilter === 'today' ? 'bg-white text-rose-700 font-bold' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {todayBirthdaysCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('this_week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'this_week'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              هذا الأسبوع
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'this_month'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
              title="أعياد ميلاد الشهر التقويمي الحالي"
            >
              هذا الشهر
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('next30')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'next30'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
              title="أعياد ميلاد خلال الـ 30 يوماً القادمة"
            >
              خلال 30 يوماً
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              كل الخدام
            </button>
          </div>

          {/* Search & Service Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">كل الخدمات</option>
              {services.map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {srv.name_ar}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Birthdays Grid / Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-stone-400">جاري تحميل أعياد ميلاد الخدام...</div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6">
          <Cake className="w-12 h-12 text-amber-500/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
            {activeFilter === 'today'
              ? 'لا توجد أعياد ميلاد لخدام في هذا اليوم'
              : 'لا توجد أعياد ميلاد مطابقة في الفترة المحددة'}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {activeFilter === 'today'
              ? 'يمكنك الاطلاع على أعياد ميلاد الأسبوع القادم أو الشهر للترتيب المسبق لخدمة التهنئة.'
              : 'تأكد من تسجيل تواريخ الميلاد في ملفات الخدام، أو قم باختيار "كل الخدام".'}
          </p>
          {activeFilter === 'today' && weekBirthdaysCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('this_week')}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>عرض أعياد ميلاد هذا الأسبوع ({weekBirthdaysCount})</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active section info bar if filtered by today */}
          {activeFilter === 'today' && todayBirthdaysCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
              <div className="flex items-center gap-2.5">
                <PartyPopper className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-rose-950 dark:text-rose-200">
                    أعياد ميلاد مباركة اليوم ({todayBirthdaysCount} خادم وخادمة)
                  </h3>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400">
                    يمكنك إرسال معايدة واتساب لكل خادم على حدة، أو النقر على "إرسال للجميع".
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBulkWhatsAppClick}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال معايدات اليوم للجميع</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((servant) => {
              const isToday = servant.daysUntilBirthday === 0;
              const isTomorrow = servant.daysUntilBirthday === 1;
              const isSent = sentServantIds.has(servant.id);

              return (
                <div
                  key={servant.id}
                  className={`bg-white dark:bg-stone-900 border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden hover:shadow-md ${
                    isToday
                      ? 'border-rose-400 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-950/20'
                      : isTomorrow
                      ? 'border-amber-300 dark:border-amber-700'
                      : 'border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {/* Top Badge Tag */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        isToday
                          ? 'bg-rose-500 text-white animate-pulse'
                          : isTomorrow
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : servant.daysUntilBirthday <= 7
                          ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <Cake className="w-3.5 h-3.5" />
                      <span>
                        {isToday
                          ? 'اليوم! عيد ميلاد سعيد 🎉'
                          : isTomorrow
                          ? 'غداً'
                          : `بعد ${servant.daysUntilBirthday} يوم`}
                      </span>
                    </span>

                    <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                      {servant.formattedBirthday}
                    </span>
                  </div>

                  {/* Servant Info */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400/80 bg-stone-100 dark:bg-stone-800 shrink-0 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300 text-base shadow-xs">
                      {servant.profile_photo ? (
                        <img
                          src={servant.profile_photo}
                          alt={servant.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{servant.full_name.charAt(0)}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white truncate">
                        {servant.full_name}
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium truncate mt-0.5">
                        {servant.service_name || 'الخدمة العامة'} • {servant.current_role || 'خادم'}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-1">
                        سيكمل بإذن الرب: <strong className="text-stone-700 dark:text-stone-300 font-bold">{servant.nextAge} سنة</strong>
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons: WhatsApp & Direct Call */}
                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(servant)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                        isSent
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      title="إرسال تهنئة مخصصة بالاسم عبر واتساب"
                    >
                      {isSent ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-200" />
                          <span>تم فتح المعايدة ✓</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4" />
                          <span>معايدة واتساب</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`tel:${servant.phone}`}
                      className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs"
                      title="اتصال هاتفي"
                    >
                      <Phone className="w-3.5 h-3.5 text-stone-500" />
                      <span>اتصال</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Bulk WhatsApp Greetings for Today's Servants */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                  <PartyPopper className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif">
                    معايدة خدام عيد ميلاد اليوم عبر واتساب 🎉
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    إجمالي {todayServants.length} خادم وخادمة يحتفلون بعيد ميلادهم اليوم
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Next Stepper Button */}
            {nextUnsentServant ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold block">المعايدة التالية المقترحة:</span>
                  <strong className="text-emerald-700 dark:text-emerald-300">{nextUnsentServant.full_name}</strong>
                  <span className="text-[11px] text-stone-500 font-mono ms-2">({nextUnsentServant.phone})</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(nextUnsentServant)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>فتح واتساب لـ {nextUnsentServant.full_name.split(' ')[0]}</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold text-center flex items-center justify-center gap-2 shrink-0">
                <Check className="w-4 h-4" />
                <span>تم فتح محادثات واتساب لجميع خدام اليوم بنجاح! شكراً لرعايتك ومحبتك.</span>
              </div>
            )}

            {/* Servants List with Message Previews */}
            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {todayServants.map((s, index) => {
                const isSent = sentServantIds.has(s.id);
                const messagePreview = getBirthdayMessage(s);

                return (
                  <div
                    key={s.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSent
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>

                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center shrink-0">
                          {s.profile_photo ? (
                            <img src={s.profile_photo} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            s.full_name.charAt(0)
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                            {s.full_name}
                          </h4>
                          <div className="text-[11px] text-stone-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>{s.phone}</span>
                            <span>•</span>
                            <span className="text-amber-700 dark:text-amber-400 font-sans">{s.service_name || 'الخدمة العامة'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                          isSent
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        {isSent ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تم الفتح ✓</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>إرسال واتساب</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Message Preview Text */}
                    <div className="mt-3 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed font-sans select-all">
                      {messagePreview}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-stone-500">
                تم إرسال: {sentServantIds.size} من {todayServants.length}
              </span>

              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
