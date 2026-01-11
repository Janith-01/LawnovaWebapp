import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-slate-900 text-slate-50 hover:bg-slate-800 active:scale-[0.98] shadow-sm',
        destructive:
          'bg-red-600 text-slate-50 hover:bg-red-700 active:scale-[0.98] shadow-sm',
        outline:
          'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]',
        secondary:
          'bg-slate-100 text-slate-900 hover:bg-slate-200 active:scale-[0.98]',
        ghost:
          'text-slate-900 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.98]',
        link:
          'text-slate-900 underline-offset-4 hover:underline',
        primary:
          'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 active:scale-[0.98] shadow-sm',
        success:
          'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
