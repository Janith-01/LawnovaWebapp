import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import Dashboard from './pages/student/Dashboard';
import ProfilePage from './pages/student/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';

// Layouts & Components
import ProtectedRoute from './routes/ProtectedRoute';

// A wrapper to handle redirection for authenticated users
const AuthRedirect = () => {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" reverseOrder={false} />
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Add Forgot/Reset Password routes here */}
          
          {/* Authenticated Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          {/* Add Change Password route here */}

          {/* Admin Routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/users" 
            element={
              <ProtectedRoute adminOnly>
                <UserManagement />
              </ProtectedRoute>
            } 
          />
          {/* Add /admin/users/:id route here */}

          {/* Redirect root path */}
          <Route path="/" element={<AuthRedirect />} />

          {/* Fallback for any other route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
