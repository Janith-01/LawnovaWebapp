import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { TokenManager } from '../services/api';
import { toast } from 'sonner';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle logout event from API interceptor (token refresh failure)
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      toast.error('Session expired. Please log in again.');
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // Initialize auth state from stored tokens
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = TokenManager.getAccessToken();
      
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user profile to validate token and get user data
        const response = await api.get('/api/users/me');
        setUser(response.data.data);
      } catch (error) {
        // Token invalid or expired - will be handled by interceptor
        TokenManager.clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = response.data.data;
    
    TokenManager.setTokens(accessToken, refreshToken);
    setUser(userData);
    toast.success('Welcome back!');
    return userData;
  }, []);

  const register = useCallback(async (data) => {
    const response = await api.post('/api/auth/register', data);
    toast.success('Registration successful! Please log in.');
    return response.data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = TokenManager.getRefreshToken();
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      TokenManager.clearTokens();
      setUser(null);
      toast.success('Logged out successfully');
    }
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
