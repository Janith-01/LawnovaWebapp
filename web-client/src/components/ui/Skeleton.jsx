import React from 'react';
import { cn } from '@/lib/utils';

const Skeleton = ({ className, ...props }) => {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-slate-800', className)}
            {...props}
        />
    );
};

const MetricCardSkeleton = () => (
    <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-6 space-y-4 shadow-xl">
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-32" />
    </div>
);

const SessionCardSkeleton = () => (
    <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 p-4 flex items-center gap-4 shadow-lg">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <div className="flex gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
            </div>
        </div>
        <Skeleton className="h-10 w-20 rounded-xl" />
    </div>
);

const RoleCardSkeleton = () => (
    <div className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-6 flex items-center gap-4 shadow-lg">
        <Skeleton className="w-16 h-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
);

const TableRowSkeleton = ({ columns = 5 }) => (
    <tr className="border-b border-slate-800/50">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="px-4 py-6">
                <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
        ))}
    </tr>
);

const ChartSkeleton = () => (
    <div className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-6 h-full flex flex-col shadow-xl">
        <div className="flex justify-between mb-8">
            <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex-1 flex items-end gap-2 mb-4 h-32">
            {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                <Skeleton
                    key={i}
                    className="flex-1 rounded-t-lg opacity-50"
                    style={{ height: `${h}%` }}
                />
            ))}
        </div>
        <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
    </div>
);

export {
    Skeleton,
    MetricCardSkeleton,
    SessionCardSkeleton,
    RoleCardSkeleton,
    TableRowSkeleton,
    ChartSkeleton,
};
