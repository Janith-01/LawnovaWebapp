import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, TrendingUp, AlertCircle, CheckCircle, FileText,
    BarChart3, ArrowLeft, Sparkles, Shield, Gavel
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mock Argument Data - Represents AI analysis of user's legal arguments
 */
const MOCK_ARGUMENTS = [
    {
        id: 1,
        text: "The defendant was seen at the scene",
        classification: "Strong",
        type: "Fact",
        reasoning: "Driver words 'witness', 'scene', 'identified' detected. Factual assertion with evidentiary support.",
        strength: 85,
        citations: ["Section 60 - Evidence Ordinance"],
        improvement: null
    },
    {
        id: 2,
        text: "I feel the arrest was mean",
        classification: "Weak",
        type: "Subjective",
        reasoning: "Lack of legal authority; used emotional hedging ('I feel'). Subjective opinion without legal grounding.",
        strength: 25,
        citations: [],
        improvement: "Rephrase using legal terminology: 'The arrest was unlawful under Article 13(1) as it violated due process.'"
    },
    {
        id: 3,
        text: "Under Article 126, the arrest is void",
        classification: "Strong",
        type: "Law",
        reasoning: "Direct citation of constitutional authority. Properly invokes fundamental rights provisions.",
        strength: 95,
        citations: ["Article 126 - Constitution of Sri Lanka"],
        improvement: null
    },
    {
        id: 4,
        text: "Everyone knows this is unfair",
        classification: "Weak",
        type: "Subjective",
        reasoning: "Vague generalization without legal support. Uses informal language ('everyone knows').",
        strength: 20,
        citations: [],
        improvement: "Provide specific legal grounds: 'This violates the principle of natural justice as established in [Case Law].'"
    },
    {
        id: 5,
        text: "The witness testified under oath on March 15th",
        classification: "Strong",
        type: "Fact",
        reasoning: "Specific factual detail with temporal reference. Credible evidentiary reference.",
        strength: 80,
        citations: ["Section 112 - Evidence Ordinance"],
        improvement: null
    },
    {
        id: 6,
        text: "Section 366 of the Penal Code requires proof of dishonest intention",
        classification: "Strong",
        type: "Law",
        reasoning: "Accurate legal citation with element identification. Demonstrates understanding of statutory requirements.",
        strength: 90,
        citations: ["Section 366 - Penal Code of Sri Lanka"],
        improvement: null
    }
];

/**
 * Calculate overall logic strength score
 */
const calculateOverallScore = (arguments) => {
    const totalStrength = arguments.reduce((sum, arg) => sum + arg.strength, 0);
    return Math.round(totalStrength / arguments.length);
};

/**
 * ArgumentAudit - Main Component
 * Displays AI-analyzed classification of user arguments with heatmap visualization
 */
const ArgumentAudit = () => {
    const navigate = useNavigate();
    const [showEvaluation, setShowEvaluation] = useState(false);
    const [arguments, setArguments] = useState([]);
    const [overallScore, setOverallScore] = useState(0);
    const [animatedScore, setAnimatedScore] = useState(0);

    // Load arguments on button click
    const handleEvaluate = () => {
        setShowEvaluation(true);
        setArguments(MOCK_ARGUMENTS);
        const score = calculateOverallScore(MOCK_ARGUMENTS);
        setOverallScore(score);

        // Animate score counter
        let current = 0;
        const increment = score / 50;
        const timer = setInterval(() => {
            current += increment;
            if (current >= score) {
                setAnimatedScore(score);
                clearInterval(timer);
            } else {
                setAnimatedScore(Math.floor(current));
            }
        }, 20);
    };

    // Get color based on strength
    const getStrengthColor = (strength) => {
        if (strength >= 70) return 'green';
        if (strength >= 40) return 'yellow';
        return 'red';
    };

    // Get background gradient based on classification
    const getClassificationStyle = (classification) => {
        if (classification === 'Strong') {
            return {
                container: 'bg-gradient-to-r from-green-950/60 to-emerald-950/40 border-green-500/40',
                badge: 'bg-green-500/20 text-green-400 border-green-500/50',
                icon: <CheckCircle className="w-5 h-5" />
            };
        } else {
            return {
                container: 'bg-gradient-to-r from-red-950/60 to-rose-950/40 border-red-500/40',
                badge: 'bg-red-500/20 text-red-400 border-red-500/50',
                icon: <AlertCircle className="w-5 h-5" />
            };
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>

                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
                            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-4xl font-black mb-1 sm:mb-2">Argument Audit</h1>
                            <p className="text-slate-400 text-sm sm:text-base">AI-Powered Legal Argument Classification & Analysis</p>
                        </div>
                    </div>
                </div>

                {/* Evaluate Button (Initial State) */}
                {!showEvaluation && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
                    >
                        <div className="text-center">
                            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 animate-pulse">
                                <Sparkles className="w-16 h-16 text-slate-900" />
                            </div>
                            <h2 className="text-3xl font-bold mb-3">Ready to Analyze Your Arguments?</h2>
                            <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
                                Our AI will classify each argument as <span className="text-green-400 font-bold">Strong</span> or{' '}
                                <span className="text-red-400 font-bold">Weak</span> based on legal reasoning.
                            </p>
                        </div>

                        <button
                            onClick={handleEvaluate}
                            className="group relative px-6 sm:px-12 py-4 sm:py-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm sm:text-lg shadow-2xl shadow-purple-500/30 transition-all hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400/20 to-indigo-400/20 blur-xl group-hover:blur-2xl transition-all" />
                            <div className="relative flex items-center gap-3">
                                <Scale className="w-6 h-6" />
                                EVALUATE ARGUMENTS
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </button>
                    </motion.div>
                )}

                {/* Evaluation Results */}
                <AnimatePresence>
                    {showEvaluation && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-8"
                        >
                            {/* Overall Score - Circular Progress */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-4 sm:p-8">
                                <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-bold mb-2">Overall Logic Strength</h3>
                                        <p className="text-slate-400 text-sm sm:text-base">Based on {arguments.length} analyzed arguments</p>
                                    </div>

                                    {/* Circular Progress */}
                                    <div className="relative w-36 h-36 sm:w-48 sm:h-48">
                                        {/* Background Circle */}
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                cx="96"
                                                cy="96"
                                                r="88"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                fill="none"
                                                className="text-slate-800"
                                            />
                                            {/* Progress Circle */}
                                            <circle
                                                cx="96"
                                                cy="96"
                                                r="88"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 88}`}
                                                strokeDashoffset={`${2 * Math.PI * 88 * (1 - animatedScore / 100)}`}
                                                className={`transition-all duration-1000 ${animatedScore >= 70 ? 'text-green-500' :
                                                        animatedScore >= 40 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        {/* Score Text */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className={`text-4xl sm:text-5xl font-black ${animatedScore >= 70 ? 'text-green-400' :
                                                    animatedScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {animatedScore}%
                                            </span>
                                            <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">
                                                {animatedScore >= 70 ? 'Strong' : animatedScore >= 40 ? 'Moderate' : 'Weak'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Arguments Table */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
                                <div className="p-4 sm:p-6 border-b border-slate-800">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <FileText className="w-6 h-6 text-purple-400" />
                                        Argument Breakdown
                                    </h3>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-400">#</th>
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-400">Argument</th>
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-400">Classification</th>
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-400">Type</th>
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-400">Strength</th>
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-400">Reasoning</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {arguments.map((arg, index) => {
                                                const style = getClassificationStyle(arg.classification);
                                                const color = getStrengthColor(arg.strength);

                                                return (
                                                    <motion.tr
                                                        key={arg.id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.1 }}
                                                        className={`hover:bg-slate-800/50 transition-colors ${style.container}`}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <span className="text-slate-400 font-mono font-bold">{arg.id}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-white font-medium text-sm leading-relaxed max-w-md">
                                                                "{arg.text}"
                                                            </p>
                                                            {arg.improvement && (
                                                                <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                                                    <p className="text-xs text-yellow-400 font-semibold mb-1">💡 Suggested Improvement:</p>
                                                                    <p className="text-xs text-yellow-300">{arg.improvement}</p>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.badge} font-bold text-xs`}>
                                                                {style.icon}
                                                                {arg.classification}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">
                                                                {arg.type === 'Fact' && <Shield className="w-3 h-3" />}
                                                                {arg.type === 'Law' && <Gavel className="w-3 h-3" />}
                                                                {arg.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${arg.strength}%` }}
                                                                        transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                                                                        className={`h-full rounded-full ${color === 'green' ? 'bg-green-500' :
                                                                                color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                                                                            }`}
                                                                    />
                                                                </div>
                                                                <span className={`text-sm font-bold ${color === 'green' ? 'text-green-400' :
                                                                        color === 'yellow' ? 'text-yellow-400' : 'text-red-400'
                                                                    }`}>
                                                                    {arg.strength}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                                                                {arg.reasoning}
                                                            </p>
                                                            {arg.citations.length > 0 && (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {arg.citations.map((citation, i) => (
                                                                        <span key={i} className="inline-block px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] text-purple-400 font-mono">
                                                                            {citation}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </motion.tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Summary Statistics */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                                <div className="bg-green-950/30 border border-green-500/30 rounded-2xl p-4 sm:p-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <CheckCircle className="w-6 h-6 text-green-400" />
                                        <h4 className="font-bold text-green-400">Strong Arguments</h4>
                                    </div>
                                    <p className="text-3xl font-black text-white">
                                        {arguments.filter(a => a.classification === 'Strong').length}
                                    </p>
                                </div>
                                <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4 sm:p-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <AlertCircle className="w-6 h-6 text-red-400" />
                                        <h4 className="font-bold text-red-400">Weak Arguments</h4>
                                    </div>
                                    <p className="text-3xl font-black text-white">
                                        {arguments.filter(a => a.classification === 'Weak').length}
                                    </p>
                                </div>
                                <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 sm:p-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Gavel className="w-6 h-6 text-purple-400" />
                                        <h4 className="font-bold text-purple-400">Legal Citations</h4>
                                    </div>
                                    <p className="text-3xl font-black text-white">
                                        {arguments.reduce((sum, a) => sum + a.citations.length, 0)}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ArgumentAudit;
