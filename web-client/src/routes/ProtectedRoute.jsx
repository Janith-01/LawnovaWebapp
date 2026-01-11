import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * ProtectedRoute - Protects routes that require authentication
 * @param {Object} props
 * @param {React.ReactNode} props.children - The protected content
 * @param {boolean} props.adminOnly - If true, only admins can access
 * @param {string} props.redirectTo - Custom redirect path (default: /auth/login)
 */
const ProtectedRoute = ({
  children,
  adminOnly = false,
  redirectTo = '/auth/login'
}) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Trying to access admin route without admin privileges
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // If children are provided, render them. Otherwise render Outlet for nested routes.
  return children ? children : <Outlet />;
};

/**
 * AdminRoute - Shorthand for admin-only protected routes
 */
const AdminRoute = ({ children }) => {
  return <ProtectedRoute adminOnly>{children}</ProtectedRoute>;
};

/**
 * GuestRoute - Routes only accessible when NOT logged in
 */
const GuestRoute = ({ children, redirectTo = '/dashboard' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default ProtectedRoute;
export { ProtectedRoute, AdminRoute, GuestRoute };
