import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import AuthLayout from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui';
import api from '../../services/api';

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  const inputRefs = useRef([]);

  // Redirect if no email in state
  useEffect(() => {
    if (!email) {
      navigate('/auth/register', { replace: true });
    }
  }, [email, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Start initial cooldown
  useEffect(() => {
    setCooldown(60);
  }, []);

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    setError('');

    // Focus last filled input or submit
    const lastIndex = Math.min(pasted.length, 6) - 1;
    inputRefs.current[lastIndex]?.focus();

    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  const handleVerify = async (otpString) => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      await api.post('/api/auth/verify-otp', {
        email,
        otp: otpString,
      });

      setIsVerified(true);
      toast.success('Email verified successfully!');

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/auth/login', {
          state: { message: 'Email verified! Please sign in.' },
          replace: true,
        });
      }, 2500);
    } catch (error) {
      const errorData = error.response?.data?.error;
      const errorMessage = errorData?.message || 'Verification failed. Please try again.';
      setError(errorMessage);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (isResending || cooldown > 0) return;
    setIsResending(true);
    setError('');

    try {
      await api.post('/api/auth/resend-otp', { email });
      toast.success('New verification code sent!');
      setCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to resend code.';
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  // Success state
  if (isVerified) {
    return (
      <AuthLayout
        title="Email Verified!"
        subtitle="Redirecting you to sign in..."
      >
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-bounce-slow">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <p className="text-slate-500 text-sm">
            Your email <strong className="text-slate-700">{email}</strong> has been verified.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        <div className="text-slate-500">
          We sent a 6-digit code to{' '}
          <strong className="text-slate-700">{email}</strong>
        </div>
      }
    >
      <div className="space-y-8">
        {/* OTP Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`
                w-12 h-14 text-center text-xl font-bold rounded-xl border-2 
                outline-none transition-all duration-200
                ${error
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : digit
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                }
                focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white
              `}
              disabled={isLoading}
              autoFocus={index === 0}
              id={`otp-input-${index}`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center">
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 inline-block">
              {error}
            </p>
          </div>
        )}

        {/* Verify Button */}
        <Button
          onClick={() => handleVerify(otp.join(''))}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-12 text-base font-semibold transition-all"
          size="lg"
          isLoading={isLoading}
          disabled={otp.join('').length !== 6 || isLoading}
        >
          Verify Email
        </Button>

        {/* Resend Section */}
        <div className="text-center space-y-3">
          <p className="text-sm text-slate-500">
            Didn't receive the code? Check your spam folder.
          </p>
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className={`
              inline-flex items-center gap-2 text-sm font-semibold transition-colors
              ${cooldown > 0 || isResending
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-indigo-600 hover:text-indigo-700 cursor-pointer'
              }
            `}
          >
            <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : isResending
                ? 'Sending...'
                : 'Resend Code'
            }
          </button>
        </div>

        {/* Back to Sign In */}
        <div className="text-center pt-2 border-t border-slate-100">
          <Link
            to="/auth/login"
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
