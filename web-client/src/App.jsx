import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { QueryProvider } from './providers/QueryProvider';
import { Toaster } from 'sonner';
import { Sparkles } from 'lucide-react';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Student Pages
import ProfilePage from './pages/student/ProfilePage';

// Mock Trial Pages (New High-Fidelity Pages)
import MockTrialDashboard from './pages/mocktrials/MockTrialDashboard';
import CourtroomCreationPage from './pages/mocktrials/CourtroomCreationPage';
import ParticipantInvitationPage from './pages/mocktrials/ParticipantInvitationPage';
import RoleAssignmentViewPage from './pages/mocktrials/RoleAssignmentViewPage';
import CourtroomPage from './pages/mocktrials/CourtroomPage';

// AI Roleplay
import GameInterface from './pages/Roleplay/GameInterface';
import TrialResults from './pages/Roleplay/TrialResults';
import CaseSetup from './pages/Roleplay/CaseSetup';
import BriefingInterface from './pages/Roleplay/BriefingInterface';
import CaseBriefing from './pages/Roleplay/CaseBriefing';

// Learning Materials
import LearningMaterials from './pages/LearningMaterials';
import JudgmentPrediction from './pages/JudgmentPrediction';
import DraftingPage from './pages/DraftingPage';
import HistoryPage from './pages/HistoryPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';

// Layouts & Route Guards
import { ProtectedRoute, GuestRoute } from './routes/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import SocketManager from './components/layout/SocketManager';

// Smart redirect based on auth status
const AuthRedirect = () => {
  const { isAdmin, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
};

function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <SocketManager />
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              className: 'text-sm',
            }}
          />
          <Router>
            <Routes>
              {/* Public Auth Routes - Only accessible when logged out */}
              <Route
                path="/auth/login"
                element={
                  <GuestRoute>
                    <LoginPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/auth/register"
                element={
                  <GuestRoute>
                    <RegisterPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/auth/forgot-password"
                element={
                  <GuestRoute>
                    <ForgotPasswordPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/auth/reset-password"
                element={
                  <GuestRoute>
                    <ResetPasswordPage />
                  </GuestRoute>
                }
              />

              {/* Legacy route redirects */}
              <Route path="/login" element={<Navigate to="/auth/login" replace />} />
              <Route path="/register" element={<Navigate to="/auth/register" replace />} />

              {/* Protected Routes with Dashboard Layout */}
              <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                {/* Dashboard - Shows Mock Trial Dashboard */}
                <Route path="/dashboard" element={<MockTrialDashboard />} />
                <Route path="/profile" element={<ProfilePage />} />




                {/* Mock Trial Routes (New High-Fidelity) */}
                <Route path="/mock-trials" element={<Navigate to="/dashboard" replace />} />
                <Route path="/mock-trials/create" element={<CourtroomCreationPage />} />
                <Route path="/mock-trials/:roomId/invite" element={<ParticipantInvitationPage />} />
                <Route path="/mock-trials/:roomId/roles" element={<RoleAssignmentViewPage />} />
                <Route path="/courtroom/:roomId" element={<CourtroomPage />} />

                {/* Learning Materials - Public Route */}
                <Route path="/learning-materials" element={<LearningMaterials />} />

                {/* Judgment Prediction - Public Route */}
                <Route path="/judgment-prediction" element={<JudgmentPrediction />} />

                <Route path="/mock-trials/:roomId/edit" element={<CourtroomCreationPage />} />
                <Route path="/mock-trials/:roomId/transcript" element={<PlaceholderPage title="Trial Transcript" />} />

                {/* AI Courtroom Entry */}
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/community" element={<PlaceholderPage title="Community" />} />
                <Route path="/messages" element={<PlaceholderPage title="Messages" />} />
                <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
                <Route path="/drafts" element={<DraftingPage />} />
                {/* Judgment Prediction is already routed above */}

                {/* AI Roleplay Setup Routes (with sidebar) */}
                <Route path="/roleplay" element={<CaseBriefing />} />
                <Route path="/roleplay/briefing" element={<BriefingInterface />} />
              </Route>

              {/* AI Roleplay Game - FULL SCREEN (no sidebar) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/roleplay/game" element={<GameInterface />} />
                <Route path="/roleplay/game/:sessionId" element={<GameInterface />} />
                <Route path="/results/:sessionId" element={<TrialResults />} />
              </Route>

              {/* Admin Routes */}
              <Route element={<ProtectedRoute adminOnly><DashboardLayout /></ProtectedRoute>}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UserManagement />} />
              </Route>

              {/* Root redirect */}
              <Route path="/" element={<AuthRedirect />} />

              {/* 404 Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

// Simple placeholder component for coming soon pages
const PlaceholderPage = ({ title }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
      <Sparkles className="w-10 h-10 text-indigo-500" />
    </div>
    <h2 className="text-2xl font-bold text-gray-900 dark:text-primary-200 mb-3">{title}</h2>
    <p className="text-gray-500 dark:text-primary-400 max-w-sm mx-auto">
      Our engineers are currently building this advanced AI module. Check back soon for the core system.
    </p>
  </div>
);

export default App;
