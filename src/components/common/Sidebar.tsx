import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  LayoutDashboard,
  Users,
  Layers,
  CalendarCheck,
  Calendar,
  ShieldCheck,
  History,
  FileSpreadsheet,
  ExternalLink,
  ShieldAlert,
  QrCode,
  Smartphone,
  Sun,
  Moon,
  Globe,
  X,
  Cake,
  Building2,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenScannerManager?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpen,
  onClose,
  onOpenScannerManager,
}) => {
  const { user, church, hasPermission, isSuperAdmin, isChurchAdmin } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const canManageScanner =
    isChurchAdmin ||
    isSuperAdmin ||
    user.role === 'priest' ||
    user.role === 'general_secretary' ||
    hasPermission('manage_roles') ||
    hasPermission('add_attendance');

  // For Super Admin: strictly show ONLY platform-level management items (Churches & Subscriptions, Audit Log)
  // Super Admin does NOT manage day-to-day church servants or attendance
  const navItems = isSuperAdmin ? [
    {
      id: 'churches',
      label: 'إدارة الكنائس والاشتراكات',
      icon: Building2,
      visible: true,
    },
    {
      id: 'audit',
      label: 'سجل رقابة المنظومة العام',
      icon: History,
      visible: true,
    },
  ] : [
    {
      id: 'dashboard',
      label: t('nav_dashboard'),
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'servants',
      label: t('nav_servants'),
      icon: Users,
      visible: hasPermission('view_servants'),
    },
    {
      id: 'birthdays',
      label: 'أعياد ميلاد الخدام 🎉',
      icon: Cake,
      visible: hasPermission('view_servants'),
    },
    {
      id: 'meetings',
      label: 'اجتماعات الخدام',
      icon: Calendar,
      visible: hasPermission('view_attendance'),
    },
    {
      id: 'attendance',
      label: t('nav_attendance'),
      icon: CalendarCheck,
      visible: hasPermission('view_attendance'),
    },
    {
      id: 'scanner',
      label: 'سكانر الحضور (QR)',
      icon: QrCode,
      visible: true,
    },
    {
      id: 'services',
      label: t('nav_services'),
      icon: Layers,
      visible: hasPermission('view_services'),
    },
    {
      id: 'reports',
      label: t('nav_reports'),
      icon: FileSpreadsheet,
      visible: hasPermission('view_reports'),
    },
    {
      id: 'users',
      label: t('nav_users'),
      icon: ShieldCheck,
      visible: hasPermission('view_users'),
    },
    {
      id: 'settings',
      label: 'إعدادات الكنيسة',
      icon: Settings,
      visible: isChurchAdmin || hasPermission('manage_church_settings') || isSuperAdmin,
    },
    {
      id: 'audit',
      label: t('nav_audit'),
      icon: History,
      visible: hasPermission('view_history'),
    },
  ];

  const handleSelect = (id: string) => {
    if (id === 'phone_verification') {
      onOpenScannerManager?.();
      onClose();
      return;
    }
    setCurrentTab(id);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop - positioned below sticky navbar */}
      {isOpen && (
        <div
          className="fixed top-16 inset-x-0 bottom-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer - strictly below Navbar and never overlapping Navbar */}
      <aside
        className={`fixed top-16 bottom-0 start-0 z-40 w-72 max-w-[85vw] bg-white dark:bg-stone-900 shadow-2xl flex flex-col border-e border-stone-200 dark:border-stone-800 transition-all duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'hidden lg:flex'
        } lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:shadow-none lg:z-30`}
      >
        {/* Mobile Header with close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
          <span className="text-xs font-bold text-stone-900 dark:text-white font-serif">
            قائمة النظام الكنسي
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Scope Banner */}
        <div className="p-3.5 border-b border-stone-100 dark:border-stone-800/80 bg-stone-50/50 dark:bg-stone-950/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 truncate">
              {user.name}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span className="truncate">
              {user.role === 'super_admin' ? t('role_super_admin') : user.role}
            </span>
            <span className="px-1.5 py-0.5 rounded-sm text-[10px] bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold shrink-0">
              {user.scope === 'all' ? t('scope_all') : t('scope_specific')}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2.5 space-y-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-0">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-700 text-white font-semibold shadow-xs'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
        </nav>

        {/* Mobile quick tools (Theme & Language) */}
        <div className="lg:hidden p-3 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>نهاري</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-stone-700" />
                <span>ليلي</span>
              </>
            )}
          </button>
          <button
            onClick={toggleLanguage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'English' : 'عربي'}</span>
          </button>
        </div>

        {/* Dedicated Distinctive Phone Verification Button */}
        {!isSuperAdmin && canManageScanner && onOpenScannerManager && (
          <div className="p-3 border-t border-stone-100 dark:border-stone-800 shrink-0">
            <button
              id="sidebar-btn-phone-verification"
              onClick={() => {
                onOpenScannerManager();
                onClose();
              }}
              className="w-full group flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-300/80 dark:border-amber-700/60 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-600 dark:bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-start min-w-0">
                  <div className="text-xs font-bold text-amber-950 dark:text-amber-200 truncate">
                    توثيق هواتف الخدام
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate">
                    كود ربط الأجهزة (5 دقائق)
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0">
                سكانر
              </span>
            </button>
          </div>
        )}

        {/* Bottom shortcut to Servant Portal - Strictly only on small screens (mobile drawer), hidden on medium & large screens where Navbar displays it */}
        {!isSuperAdmin && (
          <div className="p-3 border-t border-stone-100 dark:border-stone-800 md:hidden shrink-0">
            <button
              id="sidebar-btn-open-portal"
              onClick={() => handleSelect('portal')}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                {t('nav_portal')}
              </span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
