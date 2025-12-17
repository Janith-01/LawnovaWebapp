import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthLayout from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const RegisterPage = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      // Combine firstName and lastName into fullName, exclude confirmPassword
      const { firstName, lastName, confirmPassword, ...rest } = data;
      const payload = {
        ...rest,
        fullName: `${firstName} ${lastName}`.trim(),
      };
      await registerUser(payload);
      navigate('/login');
    } catch (error) {
      // Error handled by AuthContext toast
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:text-primary/90">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              First name
            </label>
            <div className="mt-1">
              <Input
                id="firstName"
                type="text"
                autoComplete="given-name"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              Last name
            </label>
            <div className="mt-1">
              <Input
                id="lastName"
                type="text"
                autoComplete="family-name"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <div className="mt-1">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="mt-1">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <div className="mt-1">
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Create account
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
};

export default RegisterPage;
