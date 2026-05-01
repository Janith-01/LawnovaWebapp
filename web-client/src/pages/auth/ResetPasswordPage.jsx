import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import AuthLayout from '../../components/layout/AuthLayout';
import { Button, Input, Label, Alert, AlertTitle, AlertDescription } from '../../components/ui';
import api from '../../services/api';

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setTokenError('No reset token provided. Please request a new password reset link.');
    }
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  // Password strength indicators
  const passwordChecks = {
    length: password?.length >= 8,
    uppercase: /[A-Z]/.test(password || ''),
    lowercase: /[a-z]/.test(password || ''),
    number: /\d/.test(password || ''),
  };

  const onSubmit = async (data) => {
    if (!token) {
      setTokenError('Invalid reset token');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/api/auth/reset-password', {
        token,
        newPassword: data.password,
      });
      setResetSuccess(true);
    } catch (error) {
      const errorData = error.response?.data?.error;
      const errorCode = errorData?.code;
      const errorMessage = errorData?.message || 'Failed to reset password';

      if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN') {
        setTokenError('This reset link has expired or is invalid. Please request a new one.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenError) {
    return (
      <AuthLayout
        title="Reset link invalid"
        subtitle="Unable to reset your password"
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <Alert variant="destructive" className="mb-6 text-left">
            <AlertDescription>{tokenError}</AlertDescription>
          </Alert>

          <Link to="/auth/forgot-password">
            <Button className="w-full">
              Request New Reset Link
            </Button>
          </Link>
          
          <div className="mt-4">
            <Link
              to="/auth/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (resetSuccess) {
    return (
      <AuthLayout
        title="Password reset successful"
        subtitle="Your password has been updated"
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          
          <Alert variant="success" className="mb-6 text-left">
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Your password has been reset successfully. You can now sign in with your new password.
            </AlertDescription>
          </Alert>

          <Link to="/auth/login">
            <Button className="w-full" size="lg">
              Sign In Now
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Your new password must be different from previous ones"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Password */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              className="px-3 pr-10 border-0 border-b-2 border-slate-200 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
              {...register('password')}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {/* Password Requirements */}
          {password && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-slate-500">Password requirements:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`flex items-center gap-1.5 ${passwordChecks.length ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <CheckCircle className="h-3 w-3" />
                  8+ characters
                </div>
                <div className={`flex items-center gap-1.5 ${passwordChecks.uppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <CheckCircle className="h-3 w-3" />
                  Uppercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${passwordChecks.lowercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <CheckCircle className="h-3 w-3" />
                  Lowercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${passwordChecks.number ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <CheckCircle className="h-3 w-3" />
                  Number
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className="px-3 pr-10 border-0 border-b-2 border-slate-200 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-12 text-base font-semibold transition-all mt-4"
          size="lg"
          isLoading={isLoading}
        >
          Reset Password
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/auth/login"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
