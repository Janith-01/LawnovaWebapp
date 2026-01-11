import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Loader2, Gavel } from 'lucide-react';

/**
 * DayProgressionButton - Professional "Proceed to Next Day" button
 * LawNova Theme: Dark blues/golds with smooth animations
 */
const DayProgressionButton = ({
    currentDay,
    onProceed,
    isTransitioning = false,
    className = ""
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`flex justify-center ${className}`}
        >
            <button
                onClick={onProceed}
                disabled={isTransitioning}
                className="group relative px-10 py-5 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-2 border-amber-500/50 hover:border-amber-400 shadow-2xl shadow-amber-500/20 hover:shadow-amber-400/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-wait"
            >
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 blur-xl group-hover:blur-2xl transition-all duration-300" />

                {/* Button content */}
                <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/50">
                        {isTransitioning ? (
                            <Loader2 className="w-6 h-6 text-slate-900 animate-spin" />
                        ) : (
                            <ChevronRight className="w-6 h-6 text-slate-900" />
                        )}
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                            Day {currentDay} Complete
                        </div>
                        <div className="text-lg font-black text-white">
                            Proceed to Day {currentDay + 1}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                            Or wait for time to run out
                        </div>
                    </div>
                </div>

                {/* Pulse animation */}
                {!isTransitioning && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-amber-400 animate-ping opacity-20" />
                )}
            </button>
        </motion.div>
    );
};

/**
 * DayTransitionOverlay - Full-screen transition animation
 */
export const DayTransitionOverlay = ({ nextDay }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100]"
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center"
            >
                <div className="w-24 h-24 mb-6 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 animate-pulse">
                    <Gavel className="w-12 h-12 text-slate-900" />
                </div>
                <h2 className="text-4xl font-black text-white mb-2">
                    Transitioning to Day {nextDay}
                </h2>
                <p className="text-lg text-slate-400">
                    Preparing the courtroom...
                </p>
            </motion.div>
        </motion.div>
    );
};

export default DayProgressionButton;
