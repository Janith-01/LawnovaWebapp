import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import AuthLayout from '../../components/layout/AuthLayout';
import { Button, Input, Label, Alert, AlertDescription } from '../../components/ui';
import api from '../../services/api';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      await api.post('/api/auth/forgot-password', { email: data.email });
      setEmailSent(true);
      setSentEmail(data.email);
    } catch (error) {
      // Don't reveal if email exists or not for security
      // Always show success message
      setEmailSent(true);
      setSentEmail(data.email);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: sentEmail });
      toast.success('Reset email resent successfully');
    } catch (error) {
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent password reset instructions"
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          
          <Alert variant="info" className="mb-6 text-left">
            <AlertDescription>
              If an account exists for <strong>{sentEmail}</strong>, you will receive a password reset link shortly.
            </AlertDescription>
          </Alert>

          <p className="text-sm text-slate-500 mb-6">
            Didn't receive the email? Check your spam folder or try resending.
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleResend}
              variant="outline"
              className="w-full"
              isLoading={isLoading}
            >
              Resend Email
            </Button>
            
            <Link to="/auth/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="No worries, we'll send you reset instructions"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="Email address"
              className="px-3 border-0 border-b-2 border-slate-200 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-slate-900 !bg-slate-50 text-lg placeholder:text-slate-400 !text-slate-900"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-12 text-base font-semibold transition-all mt-4"
          size="lg"
          isLoading={isLoading}
        >
          Send Reset Instructions
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/auth/login"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sign In
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
