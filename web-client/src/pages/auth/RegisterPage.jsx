import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Building, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

import AuthLayout from '../../components/layout/AuthLayout';
import { Button, Input, Label, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
  institution: z.string().optional(),
  languagePreference: z.enum(['en', 'hi', 'bn']).default('en'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, googleLogin } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      institution: '',
      languagePreference: 'en',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      // Remove confirmPassword before sending
      const { confirmPassword, ...registrationData } = data;

      await registerUser(registrationData);
      navigate('/auth/verify-email', {
        state: { email: data.email },
        replace: true,
      });
    } catch (error) {
      const errorData = error.response?.data?.error;
      const errorCode = errorData?.code;
      const errorMessage = errorData?.message || 'Registration failed. Please try again.';

      if (errorCode === 'EMAIL_EXISTS') {
        toast.error('An account with this email already exists');
      } else if (errorCode === 'VALIDATION_ERROR') {
        toast.error(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <div className="text-slate-500 mb-8">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Sign in now
          </Link>
        </div>
      }
    >

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Full Name */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="fullName"
              type="text"
              placeholder="Full Name"
              className="auth-input"
              {...register('fullName')}
              error={errors.fullName?.message}
            />
          </div>
        </div>

        {/* Email */}
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

        {/* Password */}
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
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              className="auth-input pr-10"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Institution (Optional) */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="institution"
              type="text"
              placeholder="Institution (Optional)"
              className="auth-input"
              {...register('institution')}
              error={errors.institution?.message}
            />
          </div>
        </div>



        <Button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-12 text-base font-semibold transition-all mt-4"
          size="lg"
          isLoading={isLoading}
        >
          Create Account
        </Button>

        <div className="flex justify-center mt-4">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              setIsLoading(true);
              try {
                await googleLogin(credentialResponse.credential);
                navigate('/dashboard', { replace: true });
              } catch (error) {
                const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Google Registration failed';
                toast.error(errorMessage);
              } finally {
                setIsLoading(false);
              }
            }}
            onError={() => {
              toast.error('Google Registration failed');
            }}
            theme="outline"
            shape="pill"
            size="large"
            width="100%"
            text="signup_with"
          />
        </div>
      </form>

      <p className="mt-8 text-xs text-center text-slate-400">
        By creating an account, you agree to our{' '}
        <Link to="/terms" className="underline hover:text-slate-600">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
