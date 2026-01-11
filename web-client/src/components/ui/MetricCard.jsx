import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const MetricCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendValue,
    color = 'purple',
    delay = 0
}) => {
    const colorVariants = {
        purple: 'text-purple-400',
        blue: 'text-blue-400',
        orange: 'text-orange-400',
        green: 'text-green-400',
    };

    const iconBgVariants = {
        purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
        green: 'bg-green-500/10 text-green-400 border border-green-500/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className={cn(
                'relative overflow-hidden rounded-2xl border border-slate-700/50 bg-[#1E293B] p-6 transition-all hover:border-slate-600 shadow-xl group'
            )}
        >
            {/* Background Accent Pulse */}
            <div className={cn(
                'absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20',
                color === 'purple' && 'bg-purple-500',
                color === 'blue' && 'bg-blue-500',
                color === 'orange' && 'bg-orange-500',
                color === 'green' && 'bg-green-500',
            )} />

            <div className="relative flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-400 tracking-wider uppercase">{title}</p>
                    <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">
                        {value}
                    </h3>
                </div>
                {Icon && (
                    <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110',
                        iconBgVariants[color]
                    )}>
                        <Icon size={24} />
                    </div>
                )}
            </div>

            <div className="relative mt-4 flex items-center gap-3">
                {trend && (
                    <div className={cn(
                        'flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg',
                        trend === 'up' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                    )}>
                        {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trendValue}
                    </div>
                )}
                <span className="text-xs text-slate-400 font-medium tracking-wide">{subtitle}</span>
            </div>
        </motion.div>
    );
};

export default MetricCard;
