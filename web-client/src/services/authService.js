import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';

// Query Keys
export const authKeys = {
  all: ['auth'],
  user: () => [...authKeys.all, 'user'],
  profile: () => [...authKeys.all, 'profile'],
};

// API Functions
const authApi = {
  login: async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data.data;
  },

  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data.data;
  },

  logout: async (refreshToken) => {
    await api.post('/api/auth/logout', { refreshToken });
  },

  refreshToken: async (refreshToken) => {
    const response = await api.post('/api/auth/refresh', { refreshToken });
    return response.data.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data.data;
  },

  resetPassword: async ({ token, newPassword }) => {
    const response = await api.post('/api/auth/reset-password', { token, newPassword });
    return response.data.data;
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    const response = await api.post('/api/auth/change-password', { currentPassword, newPassword });
    return response.data.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/users/me');
    return response.data.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.patch('/api/users/me', profileData);
    return response.data.data;
  },
};

// React Query Hooks

/**
 * Hook to fetch current user profile
 */
export const useProfile = (options = {}) => {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: authApi.getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Hook for login mutation
 */
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Invalidate and refetch profile data after login
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
};

/**
 * Hook for registration mutation
 */
export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register,
  });
};

/**
 * Hook for logout mutation
 */
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Clear all cached queries on logout
      queryClient.clear();
    },
  });
};

/**
 * Hook for forgot password mutation
 */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: authApi.forgotPassword,
  });
};

/**
 * Hook for reset password mutation
 */
export const useResetPassword = () => {
  return useMutation({
    mutationFn: authApi.resetPassword,
  });
};

/**
 * Hook for change password mutation
 */
export const useChangePassword = () => {
  return useMutation({
    mutationFn: authApi.changePassword,
  });
};

/**
 * Hook for update profile mutation
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      // Update cached profile data
      queryClient.setQueryData(authKeys.profile(), data);
    },
  });
};

export { authApi };
