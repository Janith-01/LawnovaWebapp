import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Gavel,
    AlertTriangle,
    Download,
    Scale,
    ChevronLeft,
    ScrollText,
    Activity,
    Star,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || window.location.origin}/api/roleplay`;

const TrialResults = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/session/${sessionId}`);
                const result = await response.json();

                if (result.success && result.data) {
                    setSessionData(result.data);
                } else {
                    toast.error('Failed to load trial results.');
                }
            } catch (err) {
                console.error("Error fetching trial results:", err);
                toast.error('Network error while loading results.');
            } finally {
                setLoading(false);
            }
        };

        if (sessionId) fetchResults();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
                <Activity className="w-12 h-12 text-indigo-500 animate-pulse mb-4" />
                <h2 className="text-xl font-bold font-serif tracking-widest text-slate-300">COMPILING LEGAL VERDICT...</h2>
            </div>
        );
    }

    if (!sessionData) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">No Record Found</h2>
                    <p className="text-slate-400 mb-6">The specified trial session does not exist or has not been finalized.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 font-semibold"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const { caseTitle, verdict, auditReport = [] } = sessionData;
    const finalOutcome = verdict?.outcome?.toUpperCase() || 'UNDETERMINED';
    const finalSummary = verdict?.summary || 'The court has not provided a final written judgment.';

    // Process Audits - Reclassified for Legal Victories vs Risks
    // Victories now include both Strong and Moderate arguments
    const strongArguments = auditReport.filter(a => a.verdict === 'Strong' || a.verdict === 'Moderate' || a.score >= 0.55);

    // Risks are now strictly for Weak arguments
    const weakArguments = auditReport.filter(a => a.verdict === 'Weak' || (a.verdict !== 'Strong' && a.verdict !== 'Moderate' && a.score < 0.55));

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-[#050B14] text-slate-200 p-4 md:p-8 font-sans overflow-x-hidden selection:bg-indigo-500/30">
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10 print:max-w-none print:p-0">
                {/* Header Section */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 print:hidden"
                >
                    <div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors text-sm font-semibold uppercase tracking-wider"
                        >
                            <ChevronLeft size={16} /> Return to Chambers
                        </button>
                        <h1 className="text-4xl md:text-5xl font-serif font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                            Trial Audit Report
                        </h1>
                        <p className="text-slate-400 mt-2 flex items-center gap-2">
                            <ScrollText size={16} /> {caseTitle || 'State v. Defendant'} - Final Review
                        </p>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded-xl text-indigo-300 font-bold transition-all hover:scale-105 active:scale-95"
                    >
                        <Download size={18} />
                        Export as PDF
                    </button>
                </motion.header>

                {/* Verdict Banner */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="relative p-1 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 mb-12 shadow-2xl glass-panel print:shadow-none print:bg-white print:text-black"
                >
                    <div className="bg-slate-900/90 rounded-xl p-8 md:p-10 border border-slate-700/50 relative overflow-hidden print:bg-white print:border-gray-300">
                        {/* Huge background icon */}
                        <Scale className="absolute -right-10 -bottom-10 w-64 h-64 text-slate-800/30 rotate-12 pointer-events-none print:hidden" />

                        <div className="relative z-10">
                            <span className={`inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4 ${finalOutcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                finalOutcome === 'LOSE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                    'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                }`}>
                                Official Judgment
                            </span>
                            <h2 className="text-3xl font-serif font-bold mb-4 text-white print:text-black">
                                {finalOutcome === 'WIN' ? "Judgment in favor of your representation." :
                                    finalOutcome === 'LOSE' ? "Judgment against your representation." :
                                        "Trial Concluded."}
                            </h2>
                            <p className="text-slate-300 leading-relaxed text-lg print:text-gray-700">
                                {finalSummary}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Two Column Layout for Arguments */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block print:w-full">

                    {/* LEFT COLUMN: Legal Victories */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center gap-3 mb-6 border-b border-emerald-900/30 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                <Gavel className="text-emerald-400 w-5 h-5" />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-white print:text-black">Legal Victories</h3>
                            <span className="ml-auto bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400 border border-slate-700 print:hidden">
                                {strongArguments.length} ARGUMENTS
                            </span>
                        </div>

                        {strongArguments.length === 0 ? (
                            <div className="p-8 text-center bg-slate-900/30 border border-slate-800/50 rounded-2xl italic text-slate-500 print:hidden">
                                No significant legal victories were recorded during this trial.
                            </div>
                        ) : (
                            strongArguments.map((arg, idx) => (
                                <ArgumentCard
                                    key={`strong-${idx}`}
                                    arg={arg}
                                    type="strong"
                                    index={idx}
                                />
                            ))
                        )}
                    </motion.div>

                    {/* RIGHT COLUMN: Legal Risks */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-6 print:mt-10"
                    >
                        <div className="flex items-center gap-3 mb-6 border-b border-rose-900/30 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                                <AlertTriangle className="text-rose-400 w-5 h-5" />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-white print:text-black">Legal Risks</h3>
                            <span className="ml-auto bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400 border border-slate-700 print:hidden">
                                {weakArguments.length} ARGUMENTS
                            </span>
                        </div>

                        {weakArguments.length === 0 ? (
                            <div className="p-8 text-center bg-slate-900/30 border border-slate-800/50 rounded-2xl italic text-slate-500 print:hidden">
                                Excellent work. No major legal flaws or risks detected.
                            </div>
                        ) : (
                            weakArguments.map((arg, idx) => (
                                <ArgumentCard
                                    key={`weak-${idx}`}
                                    arg={arg}
                                    type="weak"
                                    index={idx}
                                />
                            ))
                        )}
                    </motion.div>

                </div>
            </div>
        </div>
    );
};

// Reusable Argument Card Component
const ArgumentCard = ({ arg, type, index }) => {
    // Determine the effective verdict for styling
    const effectiveVerdict = arg.verdict || (arg.score >= 0.8 ? 'Strong' : arg.score >= 0.55 ? 'Moderate' : 'Weak');

    const isStrong = effectiveVerdict === 'Strong';
    const isModerate = effectiveVerdict === 'Moderate';
    const isWeak = effectiveVerdict === 'Weak';
    const scorePct = Math.round(arg.score * 100);

    // Dynamic styling based on argument strength
    const borderColor = isStrong ? 'border-emerald-500/30' : isModerate ? 'border-amber-500/30' : 'border-rose-500/30';
    const headerBgColor = isStrong ? 'bg-emerald-500/10' : isModerate ? 'bg-amber-500/10' : 'bg-rose-500/10';
    const scoreColor = isStrong ? 'text-emerald-400' : isModerate ? 'text-amber-400' : 'text-rose-400';
    const badgeColor = isStrong ? 'bg-emerald-500/20 text-emerald-400' : isModerate ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400';

    const statusLabel = effectiveVerdict + " Argument";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`rounded-xl bg-slate-900/40 backdrop-blur-md border ${borderColor} overflow-hidden shadow-lg print:border-gray-300 print:break-inside-avoid print:mb-6 print:shadow-none print:shadow-none print:text-black`}
        >
            {/* Header / Original Argument */}
            <div className={`p-5 ${headerBgColor} border-b border-slate-800/50 print:bg-gray-50 print:border-gray-200`}>
                <div className="flex justify-between items-start mb-3 gap-4">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-black rounded ${badgeColor} flex items-center gap-1.5`}>
                            {isStrong && <CheckCircle2 size={14} />}
                            {isModerate && <Star size={14} />}
                            {isWeak && <AlertTriangle size={14} />}
                            {statusLabel}
                        </span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-bold ${scoreColor}`}>
                        <span className="text-xl leading-none">{scorePct}%</span>
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mt-1">Logic Score</span>
                    </div>
                </div>
                <p className="text-white text-base leading-relaxed print:text-black">
                    "{arg.originalText}"
                </p>
            </div>

            {/* AI Reasoning (Glassmorphism inset) */}
            <div className="p-5 bg-slate-900/80 relative print:bg-white print:border-t print:border-dashed print:border-gray-300">
                <div className="absolute top-0 left-0 w-1 h-full opacity-50 bg-gradient-to-b from-transparent via-indigo-500 to-transparent print:hidden" />

                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2 flex items-center gap-2">
                    <SparkleIcon /> Model Reasoning
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed print:text-gray-700">
                    {arg.reason || 'Model reasoning unavailable for this argument.'}
                </p>
            </div>
        </motion.div>
    );
};

// Tiny sparkle SVG component
const SparkleIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
);

export default TrialResults;

