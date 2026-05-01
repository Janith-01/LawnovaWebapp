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
      navigate('/auth/login', {
        state: { message: 'Registration successful! Please sign in.' }
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
        <span>
          Already have an account?{' '}
          <Link to="/auth/login" className="font-bold underline text-slate-900 hover:text-blue-600">
            Sign in now
          </Link>
        </span>
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
              className="px-3 !border-x-0 !border-t-0 !border-b-2 border-slate-200 !rounded-none !shadow-none focus-visible:!ring-0 focus-visible:!outline-none focus-visible:!border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
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
              className="px-3 !border-x-0 !border-t-0 !border-b-2 border-slate-200 !rounded-none !shadow-none focus-visible:!ring-0 focus-visible:!outline-none focus-visible:!border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
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
              className="px-3 pr-10 !border-x-0 !border-t-0 !border-b-2 border-slate-200 !rounded-none !shadow-none focus-visible:!ring-0 focus-visible:!outline-none focus-visible:!border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
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
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              className="px-3 pr-10 !border-x-0 !border-t-0 !border-b-2 border-slate-200 !rounded-none !shadow-none focus-visible:!ring-0 focus-visible:!outline-none focus-visible:!border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
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

        {/* Institution (Optional) */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="institution"
              type="text"
              placeholder="Institution (Optional)"
              className="px-3 !border-x-0 !border-t-0 !border-b-2 border-slate-200 !rounded-none !shadow-none focus-visible:!ring-0 focus-visible:!outline-none focus-visible:!border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
              {...register('institution')}
              error={errors.institution?.message}
            />
          </div>
        </div>

        {/* Language Preference */}
        <div className="space-y-2">
          <div className="relative">
            <Select
              id="languagePreference"
              className="px-3 !border-x-0 !border-t-0 !border-b-2 border-slate-200 !rounded-none !shadow-none focus-visible:!ring-0 focus-visible:!outline-none focus-visible:!border-slate-900 !bg-slate-50 text-lg !text-slate-900"
              {...register('languagePreference')}
              error={errors.languagePreference?.message}
            >
              <option value="en">English Language</option>
              <option value="hi">Hindi Language</option>
              <option value="bn">Bengali Language</option>
            </Select>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-12 text-base font-semibold transition-all mt-4"
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
            shape="rectangular"
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
