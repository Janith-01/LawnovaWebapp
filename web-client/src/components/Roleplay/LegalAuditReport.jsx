import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';

const StrengthMeter = ({ score }) => {
    const percentage = Math.round(score * 100);

    // Choose color based on score
    const getMeterColor = (s) => {
        if (s >= 0.7) return 'bg-emerald-400';
        if (s >= 0.4) return 'bg-amber-400';
        return 'bg-rose-400';
    };

    return (
        <div className="w-full mt-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Argument Strength</span>
                <span className={cn("text-xs font-bold", s >= 0.7 ? "text-emerald-400" : s >= 0.4 ? "text-amber-400" : "text-rose-400")}>
                    {percentage}%
                </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800/50 overflow-hidden border border-slate-700/30">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", getMeterColor(score))}
                />
            </div>
        </div>
    );
};

const LegalAuditReport = ({ auditReport }) => {
    if (!auditReport || auditReport.length === 0) {
        return (
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                <CardContent className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Info size={40} className="mb-4 opacity-20" />
                    <p>No audited arguments available for this session.</p>
                </CardContent>
            </Card>
        );
    }

    const getVerdictStyles = (verdict) => {
        switch (verdict) {
            case 'Strong':
                return {
                    container: 'border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.05)]',
                    glow: 'bg-emerald-500/10',
                    icon: <CheckCircle className="text-emerald-400" size={18} />,
                    badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                };
            case 'Moderate':
                return {
                    container: 'border-amber-500/30 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.05)]',
                    glow: 'bg-amber-500/10',
                    icon: <TrendingUp className="text-amber-400" size={18} />,
                    badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                };
            case 'Weak':
                return {
                    container: 'border-rose-500/50 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
                    glow: 'bg-rose-500/10',
                    icon: <AlertCircle className="text-rose-400" size={18} />,
                    badge: 'bg-rose-400/10 text-rose-400 border-rose-400/20'
                };
            default:
                return {
                    container: 'border-slate-700/50 bg-slate-800/5',
                    glow: 'bg-slate-400/5',
                    icon: <Info className="text-slate-400" size={18} />,
                    badge: 'bg-slate-400/10 text-slate-400'
                };
        }
    };

    return (
        <Card className="border-slate-800 bg-[#0F172A]/80 backdrop-blur-2xl overflow-hidden shadow-2xl">
            <CardHeader className="border-b border-slate-800/50 bg-slate-900/30 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent italic">
                            Argument Audit Report
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                            Analyzed by InLegalBERT ML Engine
                        </CardDescription>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                        Live Analytics
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto no-scrollbar">
                <div className="divide-y divide-slate-800/50">
                    {auditReport.map((item, index) => {
                        const styles = getVerdictStyles(item.verdict);
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={cn(
                                    "p-5 transition-all relative group overflow-hidden",
                                    styles.container
                                )}
                            >
                                {/* Background Glow Effect */}
                                <div className={cn("absolute -right-20 -top-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700", styles.glow)} />

                                <div className="relative z-10">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {styles.icon}
                                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border", styles.badge)}>
                                                {item.verdict}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-600">ARG-{String(index + 1).padStart(3, '0')}</span>
                                    </div>

                                    <p className="text-sm text-slate-300 font-medium leading-relaxed mb-4 pl-1 border-l-2 border-slate-700 group-hover:border-slate-500 transition-colors">
                                        "{item.originalText}"
                                    </p>

                                    <StrengthMeter score={item.score} />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </CardContent>
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/40 text-center">
                <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                    This report uses machine learning to evaluate argument strength based on Sri Lankan legal corpora.
                    <br />Results are indicative and intended for educational self-reflection.
                </p>
            </div>
        </Card>
    );
};

export default LegalAuditReport;
