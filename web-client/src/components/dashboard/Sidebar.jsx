import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  LayoutDashboard,
  Gavel,
  BookOpen,
  History,
  Settings,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Brain,
  FileText,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import mockTrialService from '@/services/mockTrialService';

const studentNavItems = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard, color: 'purple' },
  { name: 'New Trial', href: '/mock-trials/create', icon: Plus, color: 'green' },
  { name: 'AI Courtroom', href: '/roleplay', icon: Sparkles, color: 'amber' },
  { name: 'AI Judgment Prediction', href: '/judgment-prediction', icon: Brain, color: 'indigo' },
  { name: 'Drafting Assistant', href: '/drafts', icon: FileText, color: 'blue' },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [showRecentSessions, setShowRecentSessions] = useState(true);
  const inAdminRoute = location.pathname.startsWith('/admin');
  const showAdminNav = isAdmin && inAdminRoute;
  const navItems = showAdminNav
    ? [
      { name: 'Admin Home', href: '/admin/dashboard', icon: LayoutDashboard, color: 'purple' },
      { name: 'User Management', href: '/admin/users', icon: Users, color: 'indigo' },
    ]
    : studentNavItems;

  // Fetch recent sessions
  const { data, isLoading } = useQuery({
    queryKey: ['recentSessionsSidebar'],
    queryFn: mockTrialService.getMyTrials,
    staleTime: 60000, // 1 minute
  });

  // Get completed sessions (most recent first)
  const recentSessions = React.useMemo(() => {
    const completed = data?.data?.rooms?.completed || [];
    return completed.slice(0, 5); // Show only last 5
  }, [data]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-opacity-75 lg:hidden",
            isDarkMode ? "bg-slate-900" : "bg-gray-600"
          )}
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 border-r flex flex-col",
        isDarkMode
          ? "bg-slate-800 text-white border-slate-700"
          : "bg-white text-gray-900 border-gray-200",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <div className="text-base font-bold leading-none">
                <span className="text-purple-500">Law</span>
                <span className={isDarkMode ? "text-white" : "text-gray-900"}>Nova</span>
              </div>
              <div className={cn("text-xs mt-1", isDarkMode ? "text-slate-400" : "text-gray-500")}>
                Legal AI Platform
              </div>
            </div>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={cn(
              "p-2 rounded-lg transition-all",
              isDarkMode
                ? "bg-slate-700 hover:bg-slate-600 text-yellow-400"
                : "bg-gray-100 hover:bg-gray-200 text-slate-700"
            )}
            aria-label="Toggle theme"
            title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Top Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => cn(
                "flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                isActive
                  ? isDarkMode
                    ? "bg-purple-900/50 text-purple-300"
                    : "bg-purple-50 text-purple-700"
                  : isDarkMode
                    ? "text-slate-300 hover:bg-slate-700"
                    : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
            >
              <div className="flex items-center">
                <item.icon className={cn(
                  "w-5 h-5 mr-3 transition-colors",
                  item.color === 'purple' ? (isDarkMode ? 'text-purple-400' : 'text-purple-600') :
                    item.color === 'green' ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                      item.color === 'amber' ? (isDarkMode ? 'text-amber-400' : 'text-amber-500') :
                        item.color === 'indigo' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-500') :
                          item.color === 'blue' ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') :
                            (isDarkMode ? 'text-slate-400' : 'text-gray-500')
                )} />
                {item.name}
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className={cn("mx-4 border-t", isDarkMode ? "border-slate-700" : "border-gray-200")} />

        {/* Recent Sessions Section */}
        <div className="flex-1 flex flex-col min-h-0 px-3 py-4">
          {/* Section Header */}
          <button
            onClick={() => setShowRecentSessions(!showRecentSessions)}
            className={cn(
              "flex items-center justify-between px-3 py-2 mb-2 rounded-lg transition-colors",
              isDarkMode ? "hover:bg-slate-700" : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-2">
              <History className={cn("w-4 h-4", isDarkMode ? "text-slate-400" : "text-gray-500")} />
              <span className={cn("text-xs font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-400" : "text-gray-500")}>
                Recent Sessions
              </span>
            </div>
            {showRecentSessions
              ? <ChevronUp className={cn("w-4 h-4", isDarkMode ? "text-slate-500" : "text-gray-400")} />
              : <ChevronDown className={cn("w-4 h-4", isDarkMode ? "text-slate-500" : "text-gray-400")} />
            }
          </button>

          {/* Sessions List */}
          {showRecentSessions && (
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={cn("w-5 h-5 animate-spin", isDarkMode ? "text-slate-500" : "text-gray-400")} />
                </div>
              ) : recentSessions?.length === 0 ? (
                <div className={cn("px-3 py-6 text-center text-sm", isDarkMode ? "text-slate-500" : "text-gray-400")}>
                  <Gavel className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No completed sessions yet
                </div>
              ) : (
                recentSessions?.map((session) => (
                  <button
                    key={session?._id || session?.id}
                    onClick={() => {
                      navigate(`/mock-trials/${session?._id || session?.id}/learning-center`);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all group",
                      isDarkMode
                        ? "hover:bg-white/5"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      isDarkMode ? "bg-slate-700" : "bg-gray-100"
                    )}>
                      <Gavel className={cn("w-4 h-4", isDarkMode ? "text-slate-400" : "text-gray-500")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate transition-colors",
                        isDarkMode
                          ? "text-slate-300 group-hover:text-white"
                          : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {session?.topic || 'Untitled Case'}
                      </p>
                      <p className={cn("text-xs mt-0.5 flex items-center gap-1", isDarkMode ? "text-slate-500" : "text-gray-400")}>
                        <Clock className="w-3 h-3" />
                        {session?.completedAt
                          ? formatDate(session.completedAt)
                          : formatDate(session?.scheduledDate)
                        }
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-2",
                      isDarkMode ? "text-slate-500" : "text-gray-400"
                    )} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className={cn("p-4 border-t shrink-0", isDarkMode ? "border-slate-700" : "border-gray-200")}>
          <NavLink
            to={showAdminNav ? '/admin/dashboard' : '/settings'}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
              isDarkMode
                ? "text-slate-300 hover:bg-slate-700"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <Settings className={cn("w-5 h-5 mr-3", isDarkMode ? "text-slate-400" : "text-gray-500")} />
            {showAdminNav ? 'Admin Dashboard' : 'Settings'}
          </NavLink>
          <button
            className={cn(
              "flex items-center w-full px-4 py-3 mt-1 text-sm font-medium rounded-xl transition-colors",
              isDarkMode
                ? "text-red-400 hover:bg-red-900/30"
                : "text-red-600 hover:bg-red-50"
            )}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
