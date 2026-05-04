import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    FileText,
    Shield,
    Sword,
    Users,
    Briefcase,
    Eye,
    EyeOff,
    ChevronRight,
    Scale,
    Sparkles,
    ArrowLeft,
    User,
    Clock,
    Target,
    BookOpen,
    Lock,
    Unlock,
    Lightbulb
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * BriefingInterface - Case Dossier Display
 * Theme: LAWNOVA-compatible with Dark/Light mode toggle
 */
const BriefingInterface = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const {
        sessionId,
        caseDetails,
        turnCount,
        maxTurns,
        selectedRole
    } = location.state || {};

    const [isVisible, setIsVisible] = useState(false);
    const { isDarkMode } = useTheme(); // Use global theme

    useEffect(() => {
        if (!sessionId || !caseDetails) {
            navigate('/roleplay');
            return;
        }
        setTimeout(() => setIsVisible(true), 100);
    }, [sessionId, caseDetails, navigate]);

    if (!caseDetails) return null;

    const isDefense = (selectedRole || caseDetails.userRole) === 'Defense';

    // Theme classes
    const themeClasses = {
        container: isDarkMode ? 'bg-slate-900 text-white' : 'bg-[#F9FAFB] text-slate-900',
        card: isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
        cardHover: isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50',
        text: isDarkMode ? 'text-slate-300' : 'text-gray-600',
        textMuted: isDarkMode ? 'text-slate-400' : 'text-gray-500',
        border: isDarkMode ? 'border-slate-700' : 'border-gray-200'
    };

    const handleEnterCourt = () => {
        navigate('/roleplay/game', {
            state: { sessionId, caseDetails, turnCount, maxTurns, selectedRole }
        });
    };

    return (
        <div className={`min-h-screen ${themeClasses.container} transition-colors duration-300`}>
            {/* Header */}
            <header className={`sticky top-0 z-10 ${themeClasses.card} border-b backdrop-blur-md px-4 py-3`}>
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
                    <button
                        onClick={() => navigate('/roleplay')}
                        className={`p-2 rounded-lg transition-colors ${themeClasses.cardHover}`}
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="flex-1 text-center min-w-0 px-2">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-xs font-semibold mb-1">
                            <FileText size={12} />
                            CASE DOSSIER
                        </span>
                        <h1 className="text-lg md:text-xl font-bold font-serif truncate">{caseDetails.title}</h1>
                        <p className={`text-xs ${themeClasses.textMuted}`}>
                            Stage: {caseDetails.caseStage || 'Opening Statements'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Role Badge */}
                        <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${isDefense ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-red-400 bg-red-50 dark:bg-red-900/20'
                            }`}>
                            {isDefense ? <Shield size={16} className="text-blue-500" /> : <Sword size={16} className="text-red-500" />}
                            <span className={`text-xs font-bold ${isDefense ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                                {isDefense ? 'DEFENSE' : 'PROSECUTION'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className={`max-w-6xl mx-auto px-4 py-6 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

                {/* Mobile Role Badge */}
                <div className={`sm:hidden flex justify-center mb-4`}>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${isDefense ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-red-400 bg-red-50 dark:bg-red-900/20'
                        }`}>
                        {isDefense ? <Shield size={16} className="text-blue-500" /> : <Sword size={16} className="text-red-500" />}
                        <span className={`text-sm font-bold ${isDefense ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                            REPRESENTING: {isDefense ? 'DEFENSE' : 'PROSECUTION'}
                        </span>
                    </div>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

                    {/* Column 1: The Incident */}
                    <div className={`${themeClasses.card} border rounded-xl overflow-hidden`}>
                        <div className={`px-4 py-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-50'} border-b ${themeClasses.border} flex items-center gap-2`}>
                            <BookOpen size={18} className="text-purple-500" />
                            <h2 className="font-semibold text-sm">The Incident</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Summary */}
                            <div>
                                <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-2`}>Case Summary</h3>
                                <p className={`text-sm ${themeClasses.text} leading-relaxed`}>{caseDetails.summary}</p>
                            </div>

                            {/* Facts */}
                            {caseDetails.facts?.length > 0 && (
                                <div>
                                    <h3 className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-2`}>
                                        <Target size={12} />
                                        Established Facts
                                    </h3>
                                    <ul className="space-y-2">
                                        {caseDetails.facts.map((fact, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="flex-shrink-0 w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-xs font-bold flex items-center justify-center">
                                                    {i + 1}
                                                </span>
                                                <span className={`text-sm ${themeClasses.text}`}>{fact}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Law */}
                            {caseDetails.relevantLaw && (
                                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                                    <p className="text-xs font-semibold text-orange-600 mb-1">Applicable Law</p>
                                    <p className="text-sm text-orange-700 dark:text-orange-300">{caseDetails.relevantLaw}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Evidence Locker */}
                    <div className={`${themeClasses.card} border rounded-xl overflow-hidden`}>
                        <div className={`px-4 py-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-50'} border-b ${themeClasses.border} flex items-center gap-2`}>
                            <Briefcase size={18} className="text-purple-500" />
                            <h2 className="font-semibold text-sm">Evidence Locker</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Your Evidence */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="flex items-center gap-2 text-xs font-semibold text-green-600">
                                        <Unlock size={12} />
                                        Your Evidence
                                    </h3>
                                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full">
                                        {caseDetails.userEvidence?.length || 0} items
                                    </span>
                                </div>
                                <ul className="space-y-2">
                                    {(caseDetails.userEvidence || []).map((evidence, i) => (
                                        <li key={i} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                                            <Eye size={14} className="text-green-500 flex-shrink-0" />
                                            <span className="text-sm text-green-700 dark:text-green-300">{evidence}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="text-center py-2">
                                <span className={`text-xs font-bold ${themeClasses.textMuted}`}>VS</span>
                            </div>

                            {/* Opposition Evidence */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="flex items-center gap-2 text-xs font-semibold text-red-600">
                                        <Lock size={12} />
                                        Opposition Evidence
                                    </h3>
                                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full">
                                        DISCLOSED
                                    </span>
                                </div>
                                <ul className="space-y-2">
                                    {(caseDetails.opponentEvidence || []).map((evidence, i) => (
                                        <li key={i} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                                            <EyeOff size={14} className="text-red-500 flex-shrink-0" />
                                            <span className="text-sm text-red-700 dark:text-red-300">{evidence}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Column 3: Witnesses */}
                    <div className={`${themeClasses.card} border rounded-xl overflow-hidden`}>
                        <div className={`px-4 py-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-50'} border-b ${themeClasses.border} flex items-center gap-2`}>
                            <Users size={18} className="text-purple-500" />
                            <h2 className="font-semibold text-sm">Witness List</h2>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3">
                                {(caseDetails.witnesses || []).map((witness, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${themeClasses.cardHover} border ${themeClasses.border}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${witness.affiliation === 'User'
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                            : witness.affiliation === 'Opponent'
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                                : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                                            }`}>
                                            <User size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{witness.name}</p>
                                            <p className={`text-xs ${themeClasses.textMuted}`}>{witness.role}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                {witness.personality}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${witness.affiliation === 'User'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                : witness.affiliation === 'Opponent'
                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                                                }`}>
                                                {witness.affiliation === 'User' ? 'Yours' : witness.affiliation === 'Opponent' ? 'Theirs' : 'Neutral'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategy Hint */}
                {caseDetails.openingHint && (
                    <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                        <Lightbulb size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Strategic Advice</p>
                            <p className={`text-sm ${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>{caseDetails.openingHint}</p>
                        </div>
                    </div>
                )}

                {/* Action Bar */}
                <div className={`${themeClasses.card} border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4`}>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Scale size={16} className="text-purple-500" />
                            <span className={themeClasses.text}>{caseDetails.difficulty} Difficulty</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-orange-500" />
                            <span className={themeClasses.text}>{maxTurns} Turns</span>
                        </div>
                    </div>

                    <button
                        onClick={handleEnterCourt}
                        className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2 text-lg"
                    >
                        <span>ENTER COURTROOM</span>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </main>
        </div>
    );
};

export default BriefingInterface;
