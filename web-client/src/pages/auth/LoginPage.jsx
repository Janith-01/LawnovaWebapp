import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

import AuthLayout from '../../components/layout/AuthLayout';
import { Button, Input, Label, Alert, AlertTitle, AlertDescription } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accountLocked, setAccountLocked] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setAccountLocked(null);

    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (error) {
      const errorData = error.response?.data?.error;
      const errorCode = errorData?.code;
      const errorMessage = errorData?.message || 'Login failed. Please try again.';

      // Handle account locked scenario
      if (errorCode === 'ACCOUNT_LOCKED') {
        const lockUntil = errorData?.lockUntil;
        setAccountLocked({
          message: errorMessage,
          lockUntil: lockUntil ? new Date(lockUntil) : null,
        });
      } else if (errorCode === 'EMAIL_NOT_VERIFIED') {
        toast.error('Please verify your email first.');
        navigate('/auth/verify-email', {
          state: { email: data.email },
        });
      } else if (errorCode === 'INVALID_CREDENTIALS') {
        const remainingAttempts = errorData?.remainingAttempts;
        if (remainingAttempts !== undefined && remainingAttempts <= 2) {
          toast.warning(`Invalid credentials. ${remainingAttempts} attempt(s) remaining before account lockout.`);
        } else {
          toast.error('Invalid email or password');
        }
      } else if (errorCode === 'ACCOUNT_INACTIVE') {
        toast.error('Your account has been deactivated. Please contact support.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatLockTime = (lockUntil) => {
    if (!lockUntil) return 'a few minutes';
    const now = new Date();
    const diff = lockUntil - now;
    const minutes = Math.ceil(diff / (1000 * 60));
    return minutes > 0 ? `${minutes} minute(s)` : 'shortly';
  };

  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle={
        <div className="text-slate-500 mb-8">
          Don't have an account?{' '}
          <Link to="/auth/register" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Create a new account now
          </Link>
          <br />
          <span className="text-sm">it's FREE! Takes less than a minute.</span>
        </div>
      }
    >
      {accountLocked && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Account Temporarily Locked
          </AlertTitle>
          <AlertDescription>
            {accountLocked.message}
            {accountLocked.lockUntil && (
              <span className="block mt-1">
                Please try again in {formatLockTime(accountLocked.lockUntil)}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="Email address"
              className="auth-input"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="auth-input pr-10"
              {...register('password')}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-12 text-base font-semibold transition-all mt-4"
          size="lg"
          isLoading={isLoading}
          disabled={!!accountLocked}
        >
          Login Now
        </Button>

        <div className="flex justify-center mt-4">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              setIsLoading(true);
              try {
                await googleLogin(credentialResponse.credential);
                navigate(from, { replace: true });
              } catch (error) {
                const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Google Login failed';
                toast.error(errorMessage);
              } finally {
                setIsLoading(false);
              }
            }}
            onError={() => {
              toast.error('Google Login failed');
            }}
            theme="outline"
            shape="pill"
            size="large"
            width="100%"
            text="signin_with"
          />
        </div>
      </form>

      <div className="mt-8 flex flex-col items-center gap-4">
        <Link
          to="/auth/forgot-password"
          className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          Forget password? <span className="font-semibold underline text-indigo-600 hover:text-indigo-700">Click here</span>
        </Link>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
