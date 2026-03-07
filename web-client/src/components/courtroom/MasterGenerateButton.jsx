import React from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Master AI Generation Button for Courtroom Owners
 * Triggers the analysis of transcript and generation of study materials
 */
const MasterGenerateButton = ({ isOwner, isProcessing, onClick }) => {
    if (!isOwner) return null;

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={onClick}
                disabled={isProcessing}
                className={cn(
                    "relative group px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 shadow-2xl overflow-hidden",
                    isProcessing
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                        : "bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 text-white border border-purple-400/30 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
                )}
            >
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-3 relative z-10">
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-white text-xs">AI is analyzing the transcript...</span>
                                <span className="text-[10px] text-gray-400 font-medium">Searching Sri Lankan Acts</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <Brain className="w-5 h-5 text-purple-200" />
                            </div>
                            <div className="flex flex-col items-start leading-tight">
                                <span className="uppercase tracking-wider">Master Generate</span>
                                <span className="text-[10px] text-purple-300 opacity-80 font-medium">Create AI Study Suite</span>
                            </div>
                        </>
                    )}
                </div>
            </button>

            {!isProcessing && (
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black animate-pulse">
                    Executive Action Required
                </p>
            )}
        </div>
    );
};

export default MasterGenerateButton;
