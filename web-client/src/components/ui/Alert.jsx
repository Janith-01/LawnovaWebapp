import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

const alertVariants = {
  default: 'bg-slate-50 text-slate-900 border-slate-200',
  destructive: 'bg-red-50 text-red-900 border-red-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  info: 'bg-blue-50 text-blue-900 border-blue-200',
};

const alertIcons = {
  default: Info,
  destructive: XCircle,
  success: CheckCircle2,
  warning: AlertCircle,
  info: Info,
};

const Alert = ({ className, variant = 'default', children, ...props }) => {
  const Icon = alertIcons[variant];
  
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4 flex items-start gap-3',
        alertVariants[variant],
        className
      )}
      {...props}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
    </div>
  );
};

const AlertTitle = ({ className, children, ...props }) => {
  return (
    <h5
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h5>
  );
};

const AlertDescription = ({ className, children, ...props }) => {
  return (
    <div className={cn('text-sm opacity-90', className)} {...props}>
      {children}
    </div>
  );
};

export { Alert, AlertTitle, AlertDescription };
