import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { api } from '../../services/api.js';
import { getCleanUserName, getUserChurchRoleTitle } from '../../utils/userDisplay.js';
import {
  Menu,
  X,
  Globe,
  Sun,
  Moon,
  LogOut,
  User,
  Cross,
  Search,
  QrCode,
  Home,
  Edit3,
  Check,
  Key,
  Building2,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  currentTab,
  setCurrentTab,
}) => {
  const { user, church, logout, updateUser, refreshUser, isSuperAdmin } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Profile modal state
  const [editName, setEditName] = useState(user?.name || '');
  const [editTitle, setEditTitle] = useState(user?.church_role_title || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openProfileModal = () => {
    if (user) {
      setEditName(user.name || '');
      setEditTitle(user.church_role_title || getUserChurchRoleTitle(user));
      setProfileMsg(null);
      setIsProfileModalOpen(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setProfileMsg({ type: 'error', text: 'يرجى كتابة الاسم' });
      return;
    }

    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const payload: any = { name: editName.trim() };
      if (!isSuperAdmin) {
        payload.church_role_title = editTitle.trim();
      }
      const res = await api.put<{ success: boolean; user: any }>('/api/auth/profile', payload);

      if (res.user) {
        updateUser(res.user);
      } else {
        updateUser({
          name: editName.trim(),
          ...(!isSuperAdmin && { church_role_title: editTitle.trim() || undefined }),
        });
      }
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'تم تحديث البيانات والصفة بنجاح!' });
      setTimeout(() => {
        setIsProfileModalOpen(false);
      }, 700);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ البيانات' });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors duration-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Left / Start: Branding & Mobile Drawer Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {user && onToggleSidebar && (
              <button
                id="btn-toggle-sidebar"
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-xl text-stone-700 dark:text-stone-200 bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 active:scale-95 transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
                aria-label="القائمة الجانبية"
                title="فتح القائمة الجانبية"
              >
                {isSidebarOpen ? <X className="w-5 h-5 text-amber-700 dark:text-amber-400" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            {/* Church / Platform Emblem & Title */}
            <div
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer min-w-0 select-none"
              onClick={() => setCurrentTab(user ? (isSuperAdmin ? 'churches' : 'dashboard') : 'dashboard')}
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-amber-600 shadow-sm shrink-0 bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center">
                {user && (church?.branding?.logo_url || church?.logo_url) ? (
                  <img
                    src={church.branding?.logo_url || church.logo_url}
                    alt={church?.name || "Logo"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : user && isSuperAdmin ? (
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />
                ) : (
                  <Cross className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white leading-tight font-serif truncate max-w-[140px] xs:max-w-[190px] sm:max-w-xs md:max-w-md">
                  {user ? (
                    isSuperAdmin ? (
                      'لوحة الإدارة المركزية'
                    ) : church?.name ? (
                      church.name
                    ) : (
                      t('church_name')
                    )
                  ) : (
                    'نظام إدارة الخدمات الكنسية'
                  )}
                </span>
                <span className="hidden sm:block text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 font-semibold truncate">
                  {user ? (
                    isSuperAdmin ? (
                      'المنظومة السحابية الموحدة للكنائس'
                    ) : church?.diocese ? (
                      `إيبارشية ${church.diocese}`
                    ) : (
                      t('app_title')
                    )
                  ) : (
                    'المنظومة الرقمية الشاملة لإدارة الكنائس والخدمات'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Right / End: Tools & User Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* When not logged in: Clear direct entrance buttons */}
            {!user && (
              <>
                {currentTab !== 'dashboard' && (
                  <button
                    id="btn-nav-home"
                    onClick={() => setCurrentTab('dashboard')}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all cursor-pointer min-h-[38px]"
                    title="الصفحة الرئيسية"
                  >
                    <Home className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden xs:inline">الرئيسية</span>
                  </button>
                )}

                <button
                  id="btn-nav-servant-portal-guest"
                  onClick={() => setCurrentTab('portal')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                    currentTab === 'portal'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="استعلام الخدام بالرقم القومي"
                >
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  <span>بوابة الخدام</span>
                </button>

                <button
                  id="btn-nav-church-login-guest"
                  onClick={() => setCurrentTab('login')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                    currentTab === 'login'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/40'
                  }`}
                  title="دخول مسؤولي الكنائس والخدام"
                >
                  <Cross className="w-3.5 h-3.5 shrink-0" />
                  <span>دخول الكنيسة</span>
                </button>

                <button
                  id="btn-nav-superadmin-login-guest"
                  onClick={() => setCurrentTab('super-admin-login')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                    currentTab === 'super-admin-login'
                      ? 'bg-stone-900 text-amber-400 shadow-md border border-amber-500/50'
                      : 'bg-stone-900 hover:bg-black text-amber-400 dark:bg-stone-800 dark:hover:bg-stone-700 border border-amber-600/40'
                  }`}
                  title="لوحة الإدارة المركزية (Super Admin) لإنشاء الكنائس والاشتراكات"
                >
                  <Key className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="hidden sm:inline">إدارة المنظومة</span>
                </button>
              </>
            )}

            {/* Quick Switch to Servant Portal - Only for church authenticated users */}
            {user && !isSuperAdmin && (
              <button
                id="btn-nav-servant-portal"
                onClick={() => setCurrentTab('portal')}
                className={`hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                  currentTab === 'portal'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
                title="بوابة استعلام الخدام"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>{t('nav_portal')}</span>
              </button>
            )}

            {/* Attendance QR Scanner - Only for church authenticated users */}
            {user && !isSuperAdmin && (
              <button
                id="btn-nav-attendance-scanner"
                onClick={() => setCurrentTab('scanner')}
                className={`hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                  currentTab === 'scanner'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/40'
                }`}
                title="سكانر تسجيل الحضور والانصراف بالـ QR"
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span>سكانر الحضور</span>
              </button>
            )}

            {/* Dark / Light Mode Toggle - Hidden on mobile */}
            <button
              id="btn-nav-toggle-theme"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'التحويل للوضع النهاري (Light Mode)' : 'التحويل للوضع الليلي (Dark Mode)'}
              className="hidden md:flex px-2 sm:px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors items-center gap-1.5 text-xs font-medium cursor-pointer min-h-[38px]"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-semibold">نهاري</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-stone-700 shrink-0" />
                  <span className="text-[11px] font-semibold">ليلي</span>
                </>
              )}
            </button>

            {/* Language Switcher - Hidden on mobile */}
            <button
              id="btn-nav-toggle-lang"
              onClick={toggleLanguage}
              title={language === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
              className="hidden md:flex px-2 sm:px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors items-center gap-1 text-xs font-bold cursor-pointer min-h-[38px]"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="uppercase text-[11px]">{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* Authenticated User Status & Logout */}
            {user ? (
              <div className="flex items-center gap-1 sm:gap-2 ps-1 sm:ps-2 border-s border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  id="btn-nav-profile"
                  onClick={openProfileModal}
                  title={isSuperAdmin ? 'تعديل اسم الحساب' : (language === 'ar' ? 'تعديل الملف الشخصي والصفة الكنسية' : 'Edit profile & role')}
                  className="flex flex-col text-right hover:bg-stone-100 dark:hover:bg-stone-800/80 px-2 py-1 rounded-xl transition-all cursor-pointer group max-w-[125px] sm:max-w-[200px]"
                >
                  <span className="text-xs font-bold text-stone-900 dark:text-white leading-tight group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate">
                    {getCleanUserName(user.name)}
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 truncate">
                    <span className="truncate">{getUserChurchRoleTitle(user)}</span>
                    {!isSuperAdmin && <Edit3 className="w-2.5 h-2.5 opacity-60 shrink-0" />}
                  </span>
                </button>
                <button
                  id="btn-nav-logout"
                  onClick={logout}
                  title={t('nav_logout')}
                  className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              (currentTab === 'portal' || currentTab === 'scanner') && (
                <button
                  id="btn-nav-login"
                  onClick={() => setCurrentTab('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>تسجيل الدخول</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Quick Profile Edit Modal */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                    تعديل الملف الشخصي والصفة
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    تغيير اسمك أو صفتك الكنسية لتظهر فوراً في النظام
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs mb-3 flex items-center gap-2 ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {profileMsg.type === 'success' && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  الاسم المعروض
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="مثال: أبانوب وجيه"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                />
              </div>

              {!isSuperAdmin ? (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    الصفة أو الرتبة الكنسية (تظهر في الناف بار والداش بورد)
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="مثال: خادم، أمين الخدمة العام، أب كاهن..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden mb-2"
                  />

                  {/* Quick Selection Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-stone-400 self-center me-1">اختر سريعاً:</span>
                    {['خادم', 'أمين الخدمة العام', 'أمين خدمة', 'أمين عام الخدمة', 'منسق مرحلة', 'أب كاهن'].map(
                      (chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setEditTitle(chip)}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            editTitle === chip
                              ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
                              : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-amber-400'
                          }`}
                        >
                          {chip}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
                  <span className="text-stone-600 dark:text-stone-400 font-medium">الصفة في المنظومة:</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300 font-serif">مدير عام المنظومة (ثابتة)</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {savingProfile ? (
                    'جاري الحفظ...'
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ التعديل</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
