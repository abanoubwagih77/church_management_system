import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/common/Navbar.js';
import { Sidebar } from './components/common/Sidebar.js';
import { Dashboard } from './components/dashboard/Dashboard.js';
import { ServantsList } from './components/servants/ServantsList.js';
import { AttendanceSheet } from './components/attendance/AttendanceSheet.js';
import { MeetingsManager } from './components/meetings/MeetingsManager.js';
import { ServicesList } from './components/services/ServicesList.js';
import { UsersList } from './components/users/UsersList.js';
import { AuditHistory } from './components/audit/AuditHistory.js';
import { ReportsView } from './components/reports/ReportsView.js';
import { ServantPortal } from './components/portal/ServantPortal.js';
import { WelcomeLanding } from './components/home/WelcomeLanding.js';
import { LoginView } from './components/auth/LoginView.js';
import { SuperAdminLoginView } from './components/auth/SuperAdminLoginView.js';
import { ScannerDeviceView } from './components/scanner/ScannerDeviceView.js';
import { ScannerManagementModal } from './components/scanner/ScannerManagementModal.js';
import { ForceChangePasswordModal } from './components/auth/ForceChangePasswordModal.js';
import { UpcomingBirthdays } from './components/servants/UpcomingBirthdays.js';
import { ChurchesManagement } from './components/superAdmin/ChurchesManagement.js';
import { ChurchSettings } from './components/tenant/ChurchSettings.js';
import { ChurchFooter } from './components/common/ChurchFooter.js';
import { SubscriptionRenewalBanner } from './components/common/SubscriptionRenewalBanner.js';

function MainApp() {
  const { user, church, setChurch, isSuperAdmin, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScannerManagerOpen, setIsScannerManagerOpen] = useState(false);
  const [servantsInitialAction, setServantsInitialAction] = useState<string | undefined>(undefined);

  // Check URL hash on load for direct access
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('super-admin') || hash.includes('admin') || hash.includes('master')) {
        if (user && isSuperAdmin) {
          setCurrentTab('churches');
        } else if (!user) {
          setCurrentTab('super-admin-login');
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [user, isSuperAdmin]);

  // Set default tab on authentication state change
  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') {
        if (currentTab !== 'audit') {
          setCurrentTab('churches');
        }
      } else {
        if (currentTab === 'churches' || currentTab === 'super-admin-login' || currentTab === 'login') {
          setCurrentTab('dashboard');
        }
      }
    } else {
      if (currentTab !== 'login' && currentTab !== 'portal' && currentTab !== 'scanner' && currentTab !== 'super-admin-login') {
        setCurrentTab('dashboard');
      }
    }
  }, [user?.id, user?.role]);

  // Dynamically sync document title with current church context
  useEffect(() => {
    if (church?.name) {
      document.title = `${church.name} | نظام إدارة الخدمات الكنسية`;
    } else if (user && isSuperAdmin) {
      document.title = `لوحة الإدارة المركزية | نظام إدارة الخدمات الكنسية`;
    } else {
      document.title = `نظام إدارة الخدمات الكنسية | Church Management System`;
    }
  }, [church?.name, user, isSuperAdmin]);

  // If initial load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 font-serif">
            نظام إدارة الخدمات الكنسية
          </span>
        </div>
      </div>
    );
  }

  // Handle navigation from dashboard buttons
  const handleNavigate = (tab: string, action?: string) => {
    setCurrentTab(tab);
    if (tab === 'servants' && action === 'add') {
      setServantsInitialAction('add');
    }
  };

  // If user is not authenticated:
  // Shows Church Welcome & Servants Landing with scripture verse, or Portal, Login, Scanner
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col transition-colors duration-200">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={(tab) => setCurrentTab(tab)}
        />
        <main className="flex-1">
          {currentTab === 'super-admin-login' && (
            <SuperAdminLoginView
              onSuccess={() => setCurrentTab('churches')}
              onBackToHome={() => {
                window.location.hash = '';
                setCurrentTab('dashboard');
              }}
            />
          )}
          {currentTab === 'login' && (
            <LoginView
              onSuccess={() => setCurrentTab('dashboard')}
              onOpenPortal={() => setCurrentTab('portal')}
              onBackToHome={() => setCurrentTab('dashboard')}
            />
          )}
          {currentTab === 'portal' && (
            <ServantPortal onBack={() => setCurrentTab('dashboard')} />
          )}
          {currentTab === 'scanner' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
              <ScannerDeviceView onBackToMain={() => setCurrentTab('dashboard')} />
            </div>
          )}
          {currentTab !== 'login' && currentTab !== 'portal' && currentTab !== 'scanner' && currentTab !== 'super-admin-login' && (
            <WelcomeLanding
              onNavigateToLogin={() => setCurrentTab('login')}
              onNavigateToPortal={() => setCurrentTab('portal')}
              onNavigateToScanner={() => setCurrentTab('scanner')}
              onNavigateToSuperAdmin={() => setCurrentTab('super-admin-login')}
            />
          )}
        </main>
        {currentTab !== 'scanner' && <ChurchFooter />}
      </div>
    );
  }

  // Authenticated Management View
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col transition-colors duration-200">
      {/* Force Password Change Modal if must_change_password is true */}
      {user.must_change_password && <ForceChangePasswordModal />}

      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        currentTab={currentTab}
        setCurrentTab={(tab) => setCurrentTab(tab)}
      />

      <div className="flex-1 flex w-full">
        {/* Sidebar only shown on management tabs (except full-screen scanner) */}
        {currentTab !== 'portal' && currentTab !== 'scanner' && (
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={(tab) => setCurrentTab(tab)}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onOpenScannerManager={() => setIsScannerManagerOpen(true)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 max-w-7xl mx-auto w-full">
          {isSuperAdmin ? (
            /* Super Admin ONLY has access to Church/Subscription Management and Platform Audit Log */
            currentTab === 'audit' ? (
              <AuditHistory />
            ) : (
              <ChurchesManagement />
            )
          ) : (
            /* Church Authenticated Users (Priest, General Secretary, Servants) */
            <>
              <SubscriptionRenewalBanner />
              {currentTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
              {currentTab === 'settings' && <ChurchSettings />}
              {currentTab === 'servants' && (
                <ServantsList
                  initialOpenAdd={servantsInitialAction === 'add'}
                  onClearInitialAdd={() => setServantsInitialAction(undefined)}
                />
              )}
              {currentTab === 'birthdays' && <UpcomingBirthdays />}
              {currentTab === 'attendance' && (
                <AttendanceSheet onNavigateToMeetings={() => setCurrentTab('meetings')} />
              )}
              {currentTab === 'meetings' && (
                <MeetingsManager onNavigateToScanner={() => setCurrentTab('scanner')} />
              )}
              {currentTab === 'scanner' && (
                <ScannerDeviceView onBackToMain={() => setCurrentTab('dashboard')} />
              )}
              {currentTab === 'services' && <ServicesList />}
              {currentTab === 'users' && <UsersList />}
              {currentTab === 'audit' && <AuditHistory />}
              {currentTab === 'reports' && <ReportsView />}
              {currentTab === 'portal' && <ServantPortal />}
              {![
                'dashboard',
                'settings',
                'servants',
                'birthdays',
                'attendance',
                'meetings',
                'scanner',
                'services',
                'users',
                'audit',
                'reports',
                'portal',
              ].includes(currentTab) && <Dashboard onNavigate={handleNavigate} />}
            </>
          )}
        </main>
      </div>

      {/* Church Footer & Social Media & Copyright */}
      {currentTab !== 'scanner' && <ChurchFooter />}

      {/* Scanner Management Modal for Priest / Admin */}
      <ScannerManagementModal
        isOpen={isScannerManagerOpen}
        onClose={() => setIsScannerManagerOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
