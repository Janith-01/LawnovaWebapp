import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Building, Globe } from 'lucide-react';
import { toast } from 'sonner';

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
  const { register: registerUser } = useAuth();

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
      subtitle="Join Lawnova and start your legal learning journey"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              className="pl-10 dark:bg-white dark:text-slate-900 dark:border-slate-200"
              {...register('fullName')}
              error={errors.fullName?.message}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              className="pl-10 dark:bg-white dark:text-slate-900 dark:border-slate-200"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              className="pl-10 pr-10 dark:bg-white dark:text-slate-900 dark:border-slate-200"
              {...register('password')}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className="pl-10 pr-10 dark:bg-white dark:text-slate-900 dark:border-slate-200"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Institution (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="institution">
            Institution <span className="text-slate-400 font-normal">(Optional)</span>
          </Label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="institution"
              type="text"
              placeholder="University or Law School"
              className="pl-10 dark:bg-white dark:text-slate-900 dark:border-slate-200"
              {...register('institution')}
              error={errors.institution?.message}
            />
          </div>
        </div>

        {/* Language Preference */}
        <div className="space-y-2">
          <Label htmlFor="languagePreference">Language Preference</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
            <Select
              id="languagePreference"
              className="pl-10 dark:bg-white dark:text-slate-900 dark:border-slate-200"
              {...register('languagePreference')}
              error={errors.languagePreference?.message}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="bn">Bengali</option>
            </Select>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full mt-6"
          size="lg"
          isLoading={isLoading}
        >
          Create Account
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/auth/login"
            className="font-semibold text-slate-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-4 text-xs text-center text-slate-400">
        By creating an account, you agree to our{' '}
        <Link to="/terms" className="underline hover:text-slate-600">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
