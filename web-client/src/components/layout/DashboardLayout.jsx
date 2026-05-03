import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import { useTheme } from '@/context/ThemeContext';
import Footer from './Footer';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isDarkMode, setTheme } = useTheme();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!isAdminRoute) {
      setTheme('dark');
    }
  }, [isAdminRoute, setTheme]);

  return (
    <div className={`flex min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      {!isAdminRoute && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {!isAdminRoute && (
          <header className="lg:hidden sticky top-0 z-30 border-b border-slate-700/70 bg-slate-900/95 backdrop-blur px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition-all hover:bg-slate-700 active:scale-95"
                aria-label="Open sidebar"
                title="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">LawNova</p>
                <p className="text-xs text-slate-400">Legal AI Platform</p>
              </div>
            </div>
          </header>
        )}
        <main className={isAdminRoute ? 'flex-1 p-0 overflow-hidden' : 'flex-1 p-6 lg:p-10'}>
          <div className={isAdminRoute ? 'w-full h-full' : 'max-w-6xl mx-auto w-full'}>
            {/* Allow nested pages to open the sidebar on mobile */}
            <Outlet context={{ openSidebar: () => setIsSidebarOpen(true) }} />
          </div>
        </main>

        {/* Make sure footer stays at the very bottom */}
        {!isAdminRoute && <Footer />}
      </div>
    </div>
  );
};

export default DashboardLayout;
