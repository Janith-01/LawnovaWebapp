import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    ChevronRight,
    Play,
    Gavel,
    Scale,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { useDaily, useDailyEvent, useAppMessage } from '@daily-co/daily-react';
import { toast } from 'sonner';
import mockTrialService from '@/services/mockTrialService';
import { cn } from '@/lib/utils';

const CourtroomTimer = ({ roomId, isJudge }) => {
    const daily = useDaily();
    const [session, setSession] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch current session status on mount
    const fetchStatus = useCallback(async () => {
        try {
            const data = await mockTrialService.getTrialSessionStatus(roomId);
            if (data.success) {
                setSession(data.data);
                calculateTimeLeft(data.data);
            }
        } catch (err) {
            console.error('[Timer] Status fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // 2. Timer Logic: Independent of video stream but synced via startedAt
    const calculateTimeLeft = useCallback((sessionData) => {
        if (!sessionData || !sessionData.isActive || !sessionData.startedAt) {
            setTimeLeft(0);
            return;
        }

        const startedAt = new Date(sessionData.startedAt).getTime();
        const now = Date.now();
        const elapsedMs = now - startedAt - (sessionData.totalPausedMs || 0);

        // Find current stage end time
        let cumulativeMinutes = 0;
        const currentStage = sessionData.stages[sessionData.currentStageIndex];

        for (let i = 0; i <= sessionData.currentStageIndex; i++) {
            cumulativeMinutes += sessionData.stages[i].allocatedMinutes;
        }

        const stageEndMs = startedAt + (cumulativeMinutes * 60 * 1000) + (sessionData.totalPausedMs || 0);
        const remaining = Math.max(0, Math.floor((stageEndMs - now) / 1000));
        setTimeLeft(remaining);
    }, []);

    // Tick every second
    useEffect(() => {
        if (!session?.isActive) return;

        const interval = setInterval(() => {
            calculateTimeLeft(session);
        }, 1000);

        return () => clearInterval(interval);
    }, [session, calculateTimeLeft]);

    // 3. LISTEN TO DAILY.CO APP MESSAGES FOR SYNC
    useAppMessage({
        onAppMessage: useCallback((ev) => {
            const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            const type = data.type;

            if (type === 'TIMER_START' || type === 'TIMER_STAGE_CHANGE' || type === 'STAGE_COMPLETE' || type === 'TIMER_LOCK_UPDATE') {
                console.log(`[Timer Sync] Received ${type}`, data);
                if (type === 'STAGE_COMPLETE') {
                    toast.success('Legal Requirements Met: Trial Progression Unlocked', {
                        icon: <Gavel className="w-5 h-5 text-green-500" />
                    });
                }
                fetchStatus(); // Refresh full state for accuracy
            }
        }, [fetchStatus])
    });

    // 4. SAFETY RULE: Start timer when first participant joins (if I am Judge/Owner)
    useDailyEvent('participant-joined', useCallback((ev) => {
        if (isJudge && (!session || !session.isActive)) {
            handleStartSession();
        }
    }, [isJudge, session]));

    const handleStartSession = async () => {
        try {
            const data = await mockTrialService.startTrialSession(roomId);
            if (data.success) {
                setSession(data.data);
                toast.success('Courtroom Session Started');
            }
        } catch (err) {
            console.error('[Timer] Start failed:', err);
        }
    };

    const handleNextStage = async () => {
        // Double check on client side for safety
        if (!currentStage?.isStageRequirementsMet) {
            toast.error('Stage requirements not met - progression remains locked');
            return;
        }

        try {
            const data = await mockTrialService.nextTrialStage(roomId);
            if (data.success) {
                setSession(data.data);
                toast.info(`Proceeding to ${data.data.stages[data.data.currentStageIndex].name}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update stage');
        }
    };

    // Formatting helpers
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentStage = session?.stages[session?.currentStageIndex];
    const progress = currentStage ? (1 - timeLeft / (currentStage.allocatedMinutes * 60)) * 100 : 0;
    const isLocked = currentStage && !currentStage.isStageRequirementsMet;

    if (isLoading) return null;

    return (
        <div className="relative group">
            {/* Main Timer Display */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-2 px-4 rounded-full shadow-2xl transition-all duration-300",
                    timeLeft < 60 && session?.isActive && "border-red-500/50 shadow-red-500/10",
                    isLocked && session?.isActive && "border-amber-500/20"
                )}
            >
                {/* Stage Indicator */}
                <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                    {isLocked ? (
                        <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
                    ) : (
                        <Scale className={cn(
                            "w-4 h-4",
                            session?.isActive ? "text-purple-400" : "text-gray-500"
                        )} />
                    )}
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-tighter text-gray-400 font-bold">
                            {isLocked ? "Requirements Pending" : "Current Stage"}
                        </span>
                        <span className="text-xs font-serif font-bold text-white truncate max-w-[120px]">
                            {session?.isActive ? currentStage?.name : "Awaiting Opening"}
                        </span>
                    </div>
                </div>

                {/* Countdown */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Clock className={cn(
                            "w-5 h-5",
                            timeLeft < 60 && session?.isActive ? "text-red-400 animate-pulse" : "text-purple-400"
                        )} />
                        {session?.isActive && (
                            <svg className="absolute -inset-1 w-7 h-7 -rotate-90">
                                <circle
                                    cx="14"
                                    cy="14"
                                    r="12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-white/5"
                                />
                                <motion.circle
                                    cx="14"
                                    cy="14"
                                    r="12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeDasharray="75.4"
                                    animate={{ strokeDashoffset: 75.4 - (75.4 * progress) / 100 }}
                                    className={cn(
                                        timeLeft < 60 ? "text-red-500" :
                                            isLocked ? "text-amber-500" : "text-purple-500"
                                    )}
                                />
                            </svg>
                        )}
                    </div>
                    <span className={cn(
                        "text-xl font-mono font-bold tracking-widest min-w-[60px]",
                        timeLeft < 60 && session?.isActive ? "text-red-400" : "text-white"
                    )}>
                        {timeLeft > 0 ? formatTime(timeLeft) : "0:00"}
                    </span>
                </div>

                {/* Controls (Judge Only) */}
                {isJudge && (
                    <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                        {!session?.isActive ? (
                            <button
                                onClick={handleStartSession}
                                className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded-full transition-colors group/btn"
                            >
                                <Play className="w-4 h-4 text-white fill-current" />
                            </button>
                        ) : (
                            <button
                                onClick={handleNextStage}
                                disabled={session.currentStageIndex >= session.stages.length - 1 || isLocked}
                                className={cn(
                                    "flex items-center gap-1 p-1.5 px-3 rounded-full transition-all text-[10px] font-bold uppercase tracking-wider",
                                    isLocked
                                        ? "bg-slate-800 text-gray-500 cursor-not-allowed border border-white/5"
                                        : "bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/20"
                                )}
                            >
                                {isLocked ? (
                                    <AlertCircle className="w-3 h-3 text-amber-500/50" />
                                ) : (
                                    <ChevronRight className="w-3 h-3" />
                                )}
                                Next
                            </button>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Micro-Interaction: Status Dots */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                {session?.stages.map((s, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "w-1 h-1 rounded-full transition-all duration-500",
                            idx === session.currentStageIndex ? "w-3 bg-purple-500" :
                                idx < session.currentStageIndex ? "bg-green-500/50" : "bg-white/10"
                        )}
                    />
                ))}
            </div>
        </div>
    );
};

export default CourtroomTimer;
