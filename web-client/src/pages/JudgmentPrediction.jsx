import React, { useState, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import judgmentService from '@/services/judgmentService';
import {
    Brain,
    Scale,
    Send,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    Search,
    FileText,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Hash,
    BookOpen,
    ArrowRight,
    RotateCcw,
    Info,
} from 'lucide-react';

const JudgmentPrediction = () => {
    const { isDarkMode } = useTheme();

    // State
    const [activeTab, setActiveTab] = useState('freetext'); // 'freetext' | 'casenum'
    const [inputText, setInputText] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [showExplanation, setShowExplanation] = useState(true);
    const [retryingExplanation, setRetryingExplanation] = useState(false);

    const resultRef = useRef(null);

    // Handler for free-text prediction with explanation
    const handlePredictFreeText = async () => {
        if (!inputText.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await judgmentService.predictWithExplanation(inputText.trim());
            setResult({ ...data, mode: 'freetext' });
            // Scroll to result
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        } catch (e) {
            const msg =
                e.response?.data?.detail ||
                e.response?.data?.message ||
                e.message ||
                'Prediction failed. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Handler for case number prediction
    const handlePredictByCaseNumber = async () => {
        if (!caseNumber.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await judgmentService.predictByCaseNumber(caseNumber.trim());
            setResult({ ...data, mode: 'casenum' });
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        } catch (e) {
            const msg =
                e.response?.data?.detail ||
                e.response?.data?.message ||
                e.message ||
                'Case lookup failed.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Reset everything
    const handleReset = () => {
        setInputText('');
        setCaseNumber('');
        setResult(null);
        setError(null);
    };

    const handleRetryExplanation = async () => {
        if (!result || result.mode !== 'freetext' || !inputText.trim()) return;

        setRetryingExplanation(true);
        setError(null);

        try {
            const data = await judgmentService.predictWithExplanation(inputText.trim());
            setResult(prev => ({
                ...prev,
                ...data,
                mode: prev?.mode || 'freetext',
            }));
        } catch (e) {
            const msg =
                e.response?.data?.detail ||
                e.response?.data?.message ||
                e.message ||
                'Retry failed. Please try again.';
            setError(msg);
        } finally {
            setRetryingExplanation(false);
        }
    };

    // Confidence percentage
    const getConfPercent = (val) => Math.round((val || 0) * 100);
    const explanationStatus = result?.explanation_status || 'generated';
    const explanationIsGenerated = explanationStatus === 'generated';

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div
                            className={cn(
                                'w-12 h-12 rounded-2xl flex items-center justify-center',
                                isDarkMode
                                    ? 'bg-gradient-to-br from-indigo-600 to-purple-700'
                                    : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                            )}
                        >
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1
                                className={cn(
                                    'text-2xl sm:text-3xl font-bold tracking-tight',
                                    isDarkMode ? 'text-white' : 'text-gray-900'
                                )}
                            >
                                AI Judgment Prediction
                            </h1>
                            <p
                                className={cn(
                                    'text-sm mt-0.5',
                                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                )}
                            >
                                Predict case outcomes using our trained ML model with AI-powered explanations
                            </p>
                        </div>
                    </div>
                </div>

                {(result || error) && (
                    <button
                        onClick={handleReset}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all',
                            isDarkMode
                                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                    >
                        <RotateCcw className="w-4 h-4" />
                        New Prediction
                    </button>
                )}
            </div>

            {/* Info Banner */}
            <div
                className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border',
                    isDarkMode
                        ? 'bg-indigo-900/20 border-indigo-800/40 text-indigo-300'
                        : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                )}
            >
                <Info className="w-5 h-5 mt-0.5 shrink-0" />
                <div className="text-sm">
                    <strong>How it works:</strong> Our model is trained on Sri Lankan Supreme Court and Court
                    of Appeal judgments. Enter case facts to predict whether an appeal would be{' '}
                    <span className="font-semibold text-green-500">ALLOWED</span> or{' '}
                    <span className="font-semibold text-red-500">DISMISSED</span>, along with an AI-generated
                    legal explanation referencing similar cases.
                </div>
            </div>

            {/* Tab Switcher */}
            <div
                className={cn(
                    'flex rounded-xl p-1 max-w-md',
                    isDarkMode ? 'bg-slate-800' : 'bg-gray-100'
                )}
            >
                <button
                    onClick={() => setActiveTab('freetext')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
                        activeTab === 'freetext'
                            ? isDarkMode
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-white text-indigo-700 shadow-sm'
                            : isDarkMode
                                ? 'text-slate-400 hover:text-slate-300'
                                : 'text-gray-500 hover:text-gray-700'
                    )}
                >
                    <FileText className="w-4 h-4" />
                    Case Facts
                </button>
                <button
                    onClick={() => setActiveTab('casenum')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
                        activeTab === 'casenum'
                            ? isDarkMode
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-white text-indigo-700 shadow-sm'
                            : isDarkMode
                                ? 'text-slate-400 hover:text-slate-300'
                                : 'text-gray-500 hover:text-gray-700'
                    )}
                >
                    <Hash className="w-4 h-4" />
                    Case Number
                </button>
            </div>

            {/* Input Area */}
            <div
                className={cn(
                    'rounded-2xl border overflow-hidden',
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                )}
            >
                {activeTab === 'freetext' ? (
                    <div>
                        <div
                            className={cn(
                                'px-5 py-3 border-b flex items-center gap-2',
                                isDarkMode ? 'border-slate-700' : 'border-gray-100'
                            )}
                        >
                            <FileText
                                className={cn(
                                    'w-4 h-4',
                                    isDarkMode ? 'text-indigo-400' : 'text-indigo-500'
                                )}
                            />
                            <span
                                className={cn(
                                    'text-sm font-medium',
                                    isDarkMode ? 'text-slate-300' : 'text-gray-700'
                                )}
                            >
                                Enter Case Facts / Scenario
                            </span>
                        </div>
                        <div className="p-4">
                            <textarea
                                className={cn(
                                    'w-full h-52 p-4 rounded-xl border resize-none text-sm leading-relaxed focus:ring-2 outline-none transition-all',
                                    isDarkMode
                                        ? 'bg-slate-900 border-slate-600 text-slate-200 placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-400'
                                )}
                                placeholder="Paste or type the case facts here... For best results, include the summary of facts, legal arguments, and relevant circumstances."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                disabled={loading}
                            />
                            <div className="flex items-center justify-between mt-3">
                                <span
                                    className={cn(
                                        'text-xs',
                                        isDarkMode ? 'text-slate-500' : 'text-gray-400'
                                    )}
                                >
                                    {inputText.length > 0
                                        ? `${inputText.split(/\s+/).filter(Boolean).length} words`
                                        : 'Minimum ~50 words recommended for accurate results'}
                                </span>
                                <button
                                    onClick={handlePredictFreeText}
                                    disabled={loading || !inputText.trim()}
                                    className={cn(
                                        'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                                        'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                                    )}
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    {loading ? 'Analyzing...' : 'Predict Outcome'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div
                            className={cn(
                                'px-5 py-3 border-b flex items-center gap-2',
                                isDarkMode ? 'border-slate-700' : 'border-gray-100'
                            )}
                        >
                            <Hash
                                className={cn(
                                    'w-4 h-4',
                                    isDarkMode ? 'text-indigo-400' : 'text-indigo-500'
                                )}
                            />
                            <span
                                className={cn(
                                    'text-sm font-medium',
                                    isDarkMode ? 'text-slate-300' : 'text-gray-700'
                                )}
                            >
                                Look Up by Case Number
                            </span>
                        </div>
                        <div className="p-4">
                            <p
                                className={cn(
                                    'text-sm mb-4',
                                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                )}
                            >
                                Search for an existing case in our database by its case number. The system will
                                extract the facts and predict the outcome, comparing with the actual result.
                            </p>
                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <Search
                                        className={cn(
                                            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                                            isDarkMode ? 'text-slate-500' : 'text-gray-400'
                                        )}
                                    />
                                    <input
                                        type="text"
                                        className={cn(
                                            'w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:ring-2 outline-none transition-all',
                                            isDarkMode
                                                ? 'bg-slate-900 border-slate-600 text-slate-200 placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500'
                                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-400'
                                        )}
                                        placeholder="e.g. SC/APPEAL/123/2023"
                                        value={caseNumber}
                                        onChange={(e) => setCaseNumber(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePredictByCaseNumber()}
                                        disabled={loading}
                                    />
                                </div>
                                <button
                                    onClick={handlePredictByCaseNumber}
                                    disabled={loading || !caseNumber.trim()}
                                    className={cn(
                                        'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                                        'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                                    )}
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                    {loading ? 'Searching...' : 'Predict'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div
                    className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border',
                        isDarkMode
                            ? 'bg-red-900/20 border-red-800/40 text-red-300'
                            : 'bg-red-50 border-red-200 text-red-700'
                    )}
                >
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium text-sm">Prediction Error</p>
                        <p className="text-sm mt-1 opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {result && (
                <div ref={resultRef} className="space-y-6">
                    {/* Prediction Result Card */}
                    <div
                        className={cn(
                            'rounded-2xl border overflow-hidden',
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                        )}
                    >
                        {/* Prediction Header */}
                        <div
                            className={cn(
                                'px-6 py-4 border-b flex items-center justify-between',
                                isDarkMode ? 'border-slate-700' : 'border-gray-100'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Scale
                                    className={cn(
                                        'w-5 h-5',
                                        isDarkMode ? 'text-indigo-400' : 'text-indigo-500'
                                    )}
                                />
                                <span
                                    className={cn(
                                        'font-semibold',
                                        isDarkMode ? 'text-white' : 'text-gray-900'
                                    )}
                                >
                                    Prediction Result
                                </span>
                            </div>
                            {result.mode === 'casenum' && result.case_number && (
                                <span
                                    className={cn(
                                        'text-xs font-mono px-3 py-1 rounded-full',
                                        isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                                    )}
                                >
                                    {result.case_number}
                                </span>
                            )}
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Verdict */}
                                <div className="space-y-6">
                                    {/* Main Prediction */}
                                    <div className="text-center">
                                        <p
                                            className={cn(
                                                'text-xs font-semibold uppercase tracking-widest mb-3',
                                                isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                            )}
                                        >
                                            {result.mode === 'casenum' ? 'Predicted Outcome' : 'AI Prediction'}
                                        </p>
                                        <div
                                            className={cn(
                                                'inline-flex items-center gap-3 px-6 py-3 rounded-2xl',
                                                (result.prediction || result.predicted_outcome) === 'ALLOWED'
                                                    ? isDarkMode
                                                        ? 'bg-emerald-900/30 border border-emerald-700/50'
                                                        : 'bg-emerald-50 border border-emerald-200'
                                                    : isDarkMode
                                                        ? 'bg-red-900/30 border border-red-700/50'
                                                        : 'bg-red-50 border border-red-200'
                                            )}
                                        >
                                            {(result.prediction || result.predicted_outcome) === 'ALLOWED' ? (
                                                <CheckCircle className="w-7 h-7 text-emerald-500" />
                                            ) : (
                                                <XCircle className="w-7 h-7 text-red-500" />
                                            )}
                                            <span
                                                className={cn(
                                                    'text-2xl font-bold',
                                                    (result.prediction || result.predicted_outcome) === 'ALLOWED'
                                                        ? 'text-emerald-500'
                                                        : 'text-red-500'
                                                )}
                                            >
                                                {result.prediction || result.predicted_outcome}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Case Number Mode: Actual vs Predicted */}
                                    {result.mode === 'casenum' && result.actual_outcome && (
                                        <div
                                            className={cn(
                                                'p-4 rounded-xl border',
                                                isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-gray-50 border-gray-200'
                                            )}
                                        >
                                            <p
                                                className={cn(
                                                    'text-xs font-semibold uppercase tracking-widest mb-2',
                                                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                                )}
                                            >
                                                Actual Outcome
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {result.actual_outcome === 'ALLOWED' ? (
                                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                                ) : result.actual_outcome === 'DISMISSED' ? (
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                ) : (
                                                    <Info className="w-5 h-5 text-yellow-500" />
                                                )}
                                                <span
                                                    className={cn(
                                                        'text-lg font-bold',
                                                        result.actual_outcome === 'ALLOWED'
                                                            ? 'text-emerald-500'
                                                            : result.actual_outcome === 'DISMISSED'
                                                                ? 'text-red-500'
                                                                : isDarkMode
                                                                    ? 'text-yellow-400'
                                                                    : 'text-yellow-600'
                                                    )}
                                                >
                                                    {result.actual_outcome}
                                                </span>
                                                {result.actual_outcome === (result.predicted_outcome || result.prediction) && (
                                                    <span
                                                        className={cn(
                                                            'ml-2 text-xs font-medium px-2 py-0.5 rounded-full',
                                                            isDarkMode
                                                                ? 'bg-emerald-900/30 text-emerald-400'
                                                                : 'bg-emerald-100 text-emerald-700'
                                                        )}
                                                    >
                                                        ✓ Match
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Facts Snippet (case number mode) */}
                                    {result.mode === 'casenum' && result.facts_snippet && (
                                        <div
                                            className={cn(
                                                'p-4 rounded-xl border',
                                                isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-gray-50 border-gray-200'
                                            )}
                                        >
                                            <p
                                                className={cn(
                                                    'text-xs font-semibold uppercase tracking-widest mb-2',
                                                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                                )}
                                            >
                                                Facts Excerpt
                                            </p>
                                            <p
                                                className={cn(
                                                    'text-sm leading-relaxed',
                                                    isDarkMode ? 'text-slate-300' : 'text-gray-600'
                                                )}
                                            >
                                                {result.facts_snippet}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Confidence */}
                                <div>
                                    <p
                                        className={cn(
                                            'text-xs font-semibold uppercase tracking-widest mb-4',
                                            isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                        )}
                                    >
                                        Confidence Analysis
                                    </p>

                                    <div className="space-y-5">
                                        {/* Allowed */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                    <span
                                                        className={cn(
                                                            'text-sm font-medium',
                                                            isDarkMode ? 'text-slate-300' : 'text-gray-700'
                                                        )}
                                                    >
                                                        Allowed
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold text-emerald-500">
                                                    {getConfPercent(result.confidence?.allowed)}%
                                                </span>
                                            </div>
                                            <div
                                                className={cn(
                                                    'w-full h-3 rounded-full overflow-hidden',
                                                    isDarkMode ? 'bg-slate-700' : 'bg-gray-100'
                                                )}
                                            >
                                                <div
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${getConfPercent(result.confidence?.allowed)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Dismissed */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                    <span
                                                        className={cn(
                                                            'text-sm font-medium',
                                                            isDarkMode ? 'text-slate-300' : 'text-gray-700'
                                                        )}
                                                    >
                                                        Dismissed
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold text-red-500">
                                                    {getConfPercent(result.confidence?.dismissed)}%
                                                </span>
                                            </div>
                                            <div
                                                className={cn(
                                                    'w-full h-3 rounded-full overflow-hidden',
                                                    isDarkMode ? 'bg-slate-700' : 'bg-gray-100'
                                                )}
                                            >
                                                <div
                                                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${getConfPercent(result.confidence?.dismissed)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Model Confidence Indicator */}
                                    <div
                                        className={cn(
                                            'mt-6 p-3 rounded-xl border',
                                            isDarkMode ? 'bg-slate-900/50 border-slate-600' : 'bg-gray-50 border-gray-200'
                                        )}
                                    >
                                        <p
                                            className={cn(
                                                'text-xs font-medium',
                                                isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                            )}
                                        >
                                            Model Confidence:{' '}
                                            <span
                                                className={cn(
                                                    'font-bold',
                                                    Math.max(
                                                        result.confidence?.allowed || 0,
                                                        result.confidence?.dismissed || 0
                                                    ) > 0.8
                                                        ? 'text-emerald-500'
                                                        : Math.max(
                                                            result.confidence?.allowed || 0,
                                                            result.confidence?.dismissed || 0
                                                        ) > 0.6
                                                            ? isDarkMode
                                                                ? 'text-yellow-400'
                                                                : 'text-yellow-600'
                                                            : 'text-red-500'
                                                )}
                                            >
                                                {Math.max(
                                                    result.confidence?.allowed || 0,
                                                    result.confidence?.dismissed || 0
                                                ) > 0.8
                                                    ? 'High'
                                                    : Math.max(
                                                        result.confidence?.allowed || 0,
                                                        result.confidence?.dismissed || 0
                                                    ) > 0.6
                                                        ? 'Moderate'
                                                        : 'Low'}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Explanation Card */}
                    {result.explanation && (
                        <div
                            className={cn(
                                'rounded-2xl border overflow-hidden',
                                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                            )}
                        >
                            <button
                                onClick={() => setShowExplanation(!showExplanation)}
                                className={cn(
                                    'w-full px-6 py-4 flex items-center justify-between border-b transition-colors',
                                    isDarkMode
                                        ? 'border-slate-700 hover:bg-slate-700/50'
                                        : 'border-gray-100 hover:bg-gray-50'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Sparkles
                                        className={cn(
                                            'w-5 h-5',
                                            isDarkMode ? 'text-purple-400' : 'text-purple-500'
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            'font-semibold',
                                            isDarkMode ? 'text-white' : 'text-gray-900'
                                        )}
                                    >
                                        AI Legal Explanation
                                    </span>
                                    <span
                                        className={cn(
                                            'text-xs px-2 py-0.5 rounded-full',
                                            isDarkMode
                                                ? 'bg-purple-900/40 text-purple-300'
                                                : 'bg-purple-100 text-purple-700'
                                        )}
                                    >
                                        Powered by Gemini
                                    </span>
                                </div>
                                {showExplanation ? (
                                    <ChevronUp
                                        className={cn(
                                            'w-5 h-5',
                                            isDarkMode ? 'text-slate-400' : 'text-gray-400'
                                        )}
                                    />
                                ) : (
                                    <ChevronDown
                                        className={cn(
                                            'w-5 h-5',
                                            isDarkMode ? 'text-slate-400' : 'text-gray-400'
                                        )}
                                    />
                                )}
                            </button>

                            {showExplanation && (
                                <div className="p-6">
                                    {!explanationIsGenerated && (
                                        <div
                                            className={cn(
                                                'mb-4 p-3 rounded-xl border text-sm',
                                                isDarkMode
                                                    ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                                            )}
                                        >
                                            <p className="font-medium">Explanation is temporarily degraded.</p>
                                            <p className="mt-1 opacity-90">
                                                {result.explanation_message || 'The prediction result is still valid.'}
                                            </p>
                                            {result.can_retry && result.mode === 'freetext' && (
                                                <button
                                                    onClick={handleRetryExplanation}
                                                    disabled={retryingExplanation}
                                                    className={cn(
                                                        'mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                                                        isDarkMode
                                                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                                                            : 'bg-white border border-amber-200 hover:bg-amber-100 text-amber-800',
                                                        retryingExplanation && 'opacity-60 cursor-not-allowed'
                                                    )}
                                                >
                                                    {retryingExplanation ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    )}
                                                    {retryingExplanation ? 'Retrying...' : 'Retry explanation'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div
                                        className={cn(
                                            'text-sm leading-relaxed whitespace-pre-wrap',
                                            isDarkMode ? 'text-slate-300' : 'text-gray-700'
                                        )}
                                    >
                                        {result.explanation}
                                    </div>

                                    {/* Citing Documents */}
                                    {result.citing_documents && result.citing_documents.length > 0 && (
                                        <div
                                            className={cn(
                                                'mt-6 pt-4 border-t',
                                                isDarkMode ? 'border-slate-700' : 'border-gray-100'
                                            )}
                                        >
                                            <p
                                                className={cn(
                                                    'text-xs font-semibold uppercase tracking-widest mb-3',
                                                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                                                )}
                                            >
                                                Referenced Documents
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {result.citing_documents.map((docId, i) => (
                                                    <span
                                                        key={i}
                                                        className={cn(
                                                            'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full',
                                                            isDarkMode
                                                                ? 'bg-slate-700 text-slate-300'
                                                                : 'bg-gray-100 text-gray-600'
                                                        )}
                                                    >
                                                        <BookOpen className="w-3 h-3" />
                                                        Doc #{docId}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Disclaimer */}
                    <div
                        className={cn(
                            'flex items-start gap-2 text-xs p-3 rounded-xl',
                            isDarkMode ? 'text-slate-500 bg-slate-800/50' : 'text-gray-400 bg-gray-50'
                        )}
                    >
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                            This prediction is generated by an AI model and should not be considered as legal
                            advice. Always consult with a qualified legal professional for actual legal matters.
                            Model accuracy depends on the quality and quantity of training data available.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JudgmentPrediction;
