import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { AuditLog } from '../../types/index.js';
import { formatUserGreeting, getCleanUserName } from '../../utils/userDisplay.js';
import {
  Users,
  UserCheck,
  UserX,
  Layers,
  ShieldCheck,
  Percent,
  PlusCircle,
  CalendarCheck,
  Calendar,
  Search,
  History,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Cake,
  Cross,
} from 'lucide-react';

interface DashboardStatsResponse {
  total_servants: number;
  active_servants: number;
  inactive_servants: number;
  total_services: number;
  total_management_users: number;
  average_attendance: number;
  services_attendance_rate?: number;
  meetings_attendance_rate?: number;
  attendance_counts: {
    present: number;
    absent: number;
    excused: number;
    total: number;
  };
  services_stats: {
    id: string;
    name_ar: string;
    code: string;
    total_servants: number;
    active_servants: number;
    attendance_rate: number;
  }[];
  recent_activities: AuditLog[];
}

interface DashboardProps {
  onNavigate: (tab: string, action?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, church } = useAuth();
  const { t, language } = useLanguage();

  const churchName = church?.name || t('church_name');
  const logoUrl = church?.logo_url || church?.branding?.logo_url;

  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; stats: DashboardStatsResponse }>('/api/reports/dashboard');
      setStats(res.stats);
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const srvRate = stats.services_attendance_rate !== undefined ? stats.services_attendance_rate : stats.average_attendance;
  const mtgRate = stats.meetings_attendance_rate !== undefined ? stats.meetings_attendance_rate : 0;

  const statCards = [
    {
      title: t('dash_total_servants'),
      value: stats.total_servants,
      icon: Users,
      color: 'text-stone-800 dark:text-stone-100',
      bg: 'bg-stone-100 dark:bg-stone-800',
    },
    {
      title: t('dash_active_servants'),
      value: stats.active_servants,
      icon: UserCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      title: t('dash_inactive_servants'),
      value: stats.inactive_servants || 0,
      icon: UserX,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
    },
    {
      title: t('dash_services_count'),
      value: stats.total_services,
      icon: Layers,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      title: language === 'ar' ? 'حضور كشوف الخدمات' : 'Services Attendance',
      value: `${srvRate}%`,
      icon: Percent,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      title: language === 'ar' ? 'حضور اجتماع الخدام العام' : 'General Meeting Att.',
      value: `${mtgRate}%`,
      icon: CalendarCheck,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
    },
    {
      title: t('dash_admin_users'),
      value: stats.total_management_users,
      icon: ShieldCheck,
      color: 'text-stone-700 dark:text-stone-300',
      bg: 'bg-stone-100 dark:bg-stone-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={churchName}
              className="w-14 h-14 rounded-full object-cover border-2 border-amber-500 shadow-md shrink-0 bg-stone-800"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-amber-950/80 border-2 border-amber-500 flex items-center justify-center text-amber-400 shadow-md shrink-0">
              <Cross className="w-7 h-7" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif">
              {language === 'ar' ? formatUserGreeting(user) : `Welcome, ${getCleanUserName(user?.name)}`}
            </h1>
            <p className="text-xs text-amber-200/90 mt-0.5">
              {churchName} • {user?.scope === 'all' ? t('scope_all') : t('scope_specific')}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-quick-add-service"
            onClick={() => onNavigate('services')}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>{language === 'ar' ? 'المراحل والخدمات' : 'Services'}</span>
          </button>
          <button
            id="btn-quick-add-servant"
            onClick={() => onNavigate('servants', 'add')}
            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('dash_action_add_servant')}</span>
          </button>
          <button
            id="btn-quick-meetings"
            onClick={() => onNavigate('meetings')}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-amber-300" />
            <span>{language === 'ar' ? 'اجتماعات الخدام' : 'Meetings'}</span>
          </button>
          <button
            id="btn-quick-birthdays"
            onClick={() => onNavigate('birthdays')}
            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition-all border border-amber-400/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Cake className="w-4 h-4 text-amber-300" />
            <span>{language === 'ar' ? 'أعياد الميلاد 🎉' : 'Birthdays'}</span>
          </button>
          <button
            id="btn-quick-record-attendance"
            onClick={() => onNavigate('attendance')}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>{t('dash_action_record_att')}</span>
          </button>
          <button
            id="btn-quick-servant-portal"
            onClick={() => onNavigate('portal')}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>{t('dash_action_servant_portal')}</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        {statCards.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 truncate" title={item.title}>
                  {item.title}
                </span>
                <div className={`p-1.5 rounded-lg shrink-0 ${item.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xl sm:text-2xl font-extrabold font-mono ${item.color}`}>
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content: Services Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services Status */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>{t('dash_services_overview')}</span>
            </h2>
            <button
              onClick={() => onNavigate('services')}
              className="text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>{language === 'ar' ? 'عرض الكل' : 'View all'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {stats.services_stats.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
                <Layers className="w-9 h-9 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  {language === 'ar' ? 'لم تقم بتسجيل أي خدمات أو مراحل كنسية بعد' : 'No church services added yet'}
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3 max-w-sm mx-auto">
                  {language === 'ar'
                    ? 'يمكنك إضافة مراحل الكنيسة (حضانة، ابتدائي، إعدادي، ثانوي، واجتماعات عامة) بضغطة زر واحدة من قائمة النماذج الجاهزة.'
                    : 'Add church stages (Nursery, Primary, Prep, Secondary, etc.) using the quick preset selector.'}
                </p>
                <button
                  onClick={() => onNavigate('services')}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إضافة خدمات الكنيسة الآن' : 'Add Church Services Now'}</span>
                </button>
              </div>
            ) : (
              stats.services_stats.map((srv) => (
                <div
                  key={srv.id}
                  className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                      {srv.name_ar}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      {language === 'ar' ? `${srv.active_servants} خادم نشط من إجمالي ${srv.total_servants}` : `${srv.active_servants} active of ${srv.total_servants} servants`}
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-xs font-semibold text-stone-500 block">
                      {t('portal_attendance_rate')}
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        srv.attendance_rate >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {srv.attendance_rate}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" />
              <span>{t('dash_recent_activity')}</span>
            </h2>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>{t('nav_audit')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {stats.recent_activities.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">
                {language === 'ar' ? 'لا توجد نشاطات مسجلة بعد' : 'No activities recorded'}
              </p>
            ) : (
              stats.recent_activities.slice(0, 6).map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-xl border border-stone-100 dark:border-stone-800/80 hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-[11px] mb-1">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      @{act.username}
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-stone-800 dark:text-stone-200 line-clamp-2 leading-relaxed">
                    {act.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
