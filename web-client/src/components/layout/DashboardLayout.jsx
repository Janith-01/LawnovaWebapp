import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import { useTheme } from '@/context/ThemeContext';
import LearningPopup from '@/components/courtroom/LearningPopup';
import Footer from './Footer';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isDarkMode } = useTheme();

  return (
    <div className={`flex min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'
      }`}>
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-10">
          <div className="max-w-6xl mx-auto w-full">
            {/* Allow nested pages to open the sidebar on mobile */}
            <Outlet context={{ openSidebar: () => setIsSidebarOpen(true) }} />
          </div>
        </main>

        {/* Make sure footer stays at the very bottom */}
        <Footer />
      </div>

      {/* Global Learning Popup - Listens for completion events globally on dashboard */}
      <LearningPopup />
    </div>
  );
};

export default DashboardLayout;
