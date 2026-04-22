import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Sword,
    Zap,
    Scale,
    ArrowRight,
    Loader2,
    ChevronRight,
    FileText,
    Briefcase,
    Users,
    User,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Lightbulb,
    Target,
    BookOpen,
    Clock,
    ChevronDown
} from 'lucide-react';

// API Configuration
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || window.location.origin}/api/roleplay`;

/**
 * CaseBriefing - The Strategic Briefing Room
 * Theme: Antigravity (Dark mode, neon accents, glassmorphism)
 * 
 * Two States:
 * - State A: Setup Strategy (Role/Difficulty selection with 3D chess)
 * - State B: Dossier Briefing (Display generated case details)
 */
const CaseBriefing = () => {
    const navigate = useNavigate();

    // === STATE MANAGEMENT ===
    const [phase, setPhase] = useState('setup'); // 'setup' | 'loading' | 'dossier'
    const [selectedRole, setSelectedRole] = useState(null);
    const [difficulty, setDifficulty] = useState('Medium');
    const [topic, setTopic] = useState('Random');
    const [error, setError] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    // Fade in effect
    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    // Reset visibility on phase change for smooth transitions
    useEffect(() => {
        setIsVisible(false);
        setTimeout(() => setIsVisible(true), 100);
    }, [phase]);

    // Determine accent colors based on role
    const accentColors = selectedRole === 'Defense'
        ? {
            primary: 'cyan',
            glow: 'shadow-cyan-500/50',
            border: 'border-cyan-500',
            bg: 'bg-cyan-500',
            bgMuted: 'bg-cyan-500/10',
            text: 'text-cyan-400',
            ring: 'ring-cyan-500'
        }
        : selectedRole === 'Prosecution'
            ? {
                primary: 'orange',
                glow: 'shadow-orange-500/50',
                border: 'border-orange-500',
                bg: 'bg-orange-500',
                bgMuted: 'bg-orange-500/10',
                text: 'text-orange-400',
                ring: 'ring-orange-500'
            }
            : {
                primary: 'purple',
                glow: 'shadow-purple-500/50',
                border: 'border-purple-500',
                bg: 'bg-purple-500',
                bgMuted: 'bg-purple-500/10',
                text: 'text-purple-400',
                ring: 'ring-purple-500'
            };

    // Difficulty configurations (Time-based Real-Time Simulation)
    const difficulties = [
        { id: 'Easy', label: 'TRAINEE', timePerDay: '10 Min', totalTime: '30 Min Total', days: 3, icon: '🎓', description: 'Slower pace. Lenient judge.' },
        { id: 'Medium', label: 'ASSOCIATE', timePerDay: '5 Min', totalTime: '15 Min Total', days: 3, icon: '⚖️', description: 'Standard courtroom pressure.' },
        { id: 'Hard', label: 'SENIOR', timePerDay: '3 Min', totalTime: '9 Min Total', days: 3, icon: '🏛️', description: 'Rapid fire. Hostile witnesses.' }
    ];

    // Topic options
    const topics = [
        { id: 'Random', label: 'Random', icon: '🎲' },
        { id: 'Theft', label: 'Theft', icon: '💎' },
        { id: 'Contract', label: 'Contract', icon: '📜' },
        { id: 'Murder', label: 'Murder', icon: '🔪' },
        { id: 'Fraud', label: 'Fraud', icon: '💳' },
        { id: 'Property', label: 'Property', icon: '🏠' }
    ];

    /**
     * Handle case generation
     */
    const handleGenerateCase = async () => {
        if (!selectedRole) {
            setError('Please select your role to proceed');
            return;
        }

        setPhase('loading');
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/generate-case`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    difficulty,
                    topic,
                    userRole: selectedRole,
                    gameMode: 'TimeBased'  // Real-time simulation
                })
            });

            const data = await response.json();

            if (data.success) {
                setSessionData(data.data);
                setPhase('dossier');
            } else {
                setError(data.error || 'Failed to generate case');
                setPhase('setup');
            }
        } catch (err) {
            console.error('API Error:', err);
            setError('Connection failed. Ensure the server is running.');
            setPhase('setup');
        }
    };

    /**
     * Navigate to courtroom
     */
    const handleEnterCourt = () => {
        navigate('/roleplay/game', {
            state: {
                sessionId: sessionData.sessionId,
                caseDetails: sessionData.caseDetails,
                turnCount: sessionData.turnCount,
                maxTurns: sessionData.maxTurns,
                currentDay: sessionData.currentDay || 1,
                maxDays: sessionData.maxDays || 3,
                timeRemaining: sessionData.timeRemaining || sessionData.timeLimitPerDay,
                timeLimitPerDay: sessionData.timeLimitPerDay,
                selectedRole: selectedRole,
                difficulty: difficulty,
                gameMode: 'TimeBased'
            }
        });
    };

    // ============================================================
    // RENDER: LOADING STATE
    // ============================================================
    if (phase === 'loading') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                {/* Animated background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
                </div>

                {/* Loading Card */}
                <div className="relative z-10 backdrop-blur-xl bg-slate-900/60 border border-slate-700 rounded-3xl p-12 text-center max-w-md mx-4">
                    {/* Spinning rings */}
                    <div className="relative w-32 h-32 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-ping" />
                        <div className="absolute inset-2 border-4 border-cyan-500/50 border-t-transparent rounded-full animate-spin" />
                        <div className="absolute inset-4 border-4 border-orange-500/50 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Scale size={40} className={`${accentColors.text} animate-pulse`} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 font-serif">Initializing Case</h2>
                    <p className="text-slate-400 text-sm">Accessing classified files...</p>

                    {/* Progress dots */}
                    <div className="flex justify-center gap-2 mt-6">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${accentColors.bg} animate-bounce`}
                                style={{ animationDelay: `${i * 0.2}s` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ============================================================
    // RENDER: SETUP STRATEGY (STATE A)
    // ============================================================
    if (phase === 'setup') {
        return (
            <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
                {/* Animated Background */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-3xl" />
                    {selectedRole === 'Defense' && (
                        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
                    )}
                    {selectedRole === 'Prosecution' && (
                        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
                    )}
                    {/* Grid overlay */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M0%200h1v40H0V0zm39%200h1v40h-1V0zM0%200h40v1H0V0zm0%2039h40v1H0v-1z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
                </div>

                {/* Main content - Centered */}
                <div className={`relative z-10 min-h-screen flex items-center justify-center p-6 transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

                    {/* Main Card */}
                    <div className="w-full max-w-2xl">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className={`w-16 h-16 rounded-2xl ${accentColors.bgMuted} ${accentColors.border} border mx-auto flex items-center justify-center mb-4`}>
                                <Scale size={32} className={accentColors.text} />
                            </div>
                            <h1 className="text-3xl lg:text-4xl font-bold font-serif tracking-tight mb-2">AI COURTROOM</h1>
                            <p className="text-slate-400">Configure your legal battle simulation</p>
                        </div>

                        {/* Glassmorphism Card */}
                        <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-3xl p-8">

                            {/* Role Selection */}
                            <section className="mb-8">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className={`w-1 h-4 ${accentColors.bg} rounded-full`} />
                                    CHOOSE YOUR SIDE
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Defense Card */}
                                    <button
                                        onClick={() => setSelectedRole('Defense')}
                                        className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${selectedRole === 'Defense'
                                            ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/25'
                                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                                            }`}
                                    >
                                        {/* Glow effect */}
                                        {selectedRole === 'Defense' && (
                                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent" />
                                        )}
                                        <div className="relative">
                                            <Shield
                                                size={48}
                                                className={`mx-auto mb-4 transition-all ${selectedRole === 'Defense'
                                                    ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                                                    : 'text-slate-500 group-hover:text-slate-400'
                                                    }`}
                                            />
                                            <h4 className={`font-bold text-lg mb-1 ${selectedRole === 'Defense' ? 'text-cyan-300' : 'text-white'}`}>DEFENSE</h4>
                                            <p className="text-xs text-slate-400">Protect the Accused</p>
                                        </div>
                                    </button>

                                    {/* Prosecution Card */}
                                    <button
                                        onClick={() => setSelectedRole('Prosecution')}
                                        className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${selectedRole === 'Prosecution'
                                            ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/25'
                                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                                            }`}
                                    >
                                        {selectedRole === 'Prosecution' && (
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent" />
                                        )}
                                        <div className="relative">
                                            <Sword
                                                size={48}
                                                className={`mx-auto mb-4 transition-all ${selectedRole === 'Prosecution'
                                                    ? 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]'
                                                    : 'text-slate-500 group-hover:text-slate-400'
                                                    }`}
                                            />
                                            <h4 className={`font-bold text-lg mb-1 ${selectedRole === 'Prosecution' ? 'text-orange-300' : 'text-white'}`}>PROSECUTION</h4>
                                            <p className="text-xs text-slate-400">Seek Justice</p>
                                        </div>
                                    </button>
                                </div>
                            </section>

                            {/* Topic Selection */}
                            <section className="mb-8">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className={`w-1 h-4 ${accentColors.bg} rounded-full`} />
                                    CASE CATEGORY
                                </h3>

                                <div className="flex flex-wrap gap-2">
                                    {topics.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTopic(t.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${topic === t.id
                                                ? `${accentColors.border} ${accentColors.bgMuted} ${accentColors.text}`
                                                : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                                                }`}
                                        >
                                            <span>{t.icon}</span>
                                            <span className="text-sm font-medium">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Simulation Intensity Selection */}
                            <section className="mb-8">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className={`w-1 h-4 ${accentColors.bg} rounded-full`} />
                                    SIMULATION INTENSITY
                                </h3>

                                <div className="grid grid-cols-3 gap-3">
                                    {difficulties.map((d) => (
                                        <button
                                            key={d.id}
                                            onClick={() => setDifficulty(d.id)}
                                            className={`relative p-4 rounded-xl border-2 transition-all ${difficulty === d.id
                                                ? `${accentColors.border} ${accentColors.bgMuted}`
                                                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                                }`}
                                        >
                                            <span className="text-2xl block mb-2">{d.icon}</span>
                                            <p className={`font-bold text-sm ${difficulty === d.id ? accentColors.text : 'text-white'}`}>{d.label}</p>
                                            <p className="text-xs text-slate-400">{d.days}-Day Trial</p>
                                            <p className={`text-[10px] font-bold mt-1 ${difficulty === d.id ? accentColors.text : 'text-slate-500'}`}>{d.timePerDay}/Day</p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center">
                                    ⚠️ {error}
                                </div>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerateCase}
                                disabled={!selectedRole}
                                className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${selectedRole
                                    ? `${accentColors.bg} text-slate-900 hover:brightness-110 shadow-lg ${accentColors.glow} hover:scale-[1.02]`
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                <Zap size={24} className={selectedRole ? '' : 'opacity-50'} />
                                <span>INITIALIZE CASE SIMULATION</span>
                            </button>

                            {/* Footer */}
                            <p className="text-center text-xs text-slate-500 mt-6">
                                Powered by Gemini AI • Sri Lankan Law Curriculum
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================================
    // RENDER: DOSSIER BRIEFING (STATE B)
    // ============================================================
    const caseDetails = sessionData?.caseDetails || {};
    const isDefense = selectedRole === 'Defense';

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-0 right-0 w-[600px] h-[600px] ${isDefense ? 'bg-cyan-600/10' : 'bg-orange-600/10'} rounded-full blur-3xl`} />
                <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] ${isDefense ? 'bg-blue-600/10' : 'bg-red-600/10'} rounded-full blur-3xl`} />
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Cpath%20d%3D%22M0%200h1v40H0V0zm39%200h1v40h-1V0zM0%200h40v1H0V0zm0%2039h40v1H0v-1z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
            </div>

            {/* Header */}
            <header className={`sticky top-0 z-20 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    {/* Left - Back button */}
                    <button
                        onClick={() => setPhase('setup')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronDown size={20} className="rotate-90" />
                        <span className="text-sm font-medium">Back</span>
                    </button>

                    {/* Center - Case Title */}
                    <div className="flex-1 text-center">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${accentColors.bgMuted} ${accentColors.text} text-xs font-bold mb-1`}>
                            <FileText size={12} />
                            CASE FILE GENERATED
                        </span>
                        <h1 className="text-lg lg:text-xl font-bold font-serif truncate">{caseDetails.title}</h1>
                    </div>

                    {/* Right - Role Badge */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${accentColors.border} ${accentColors.bgMuted}`}>
                        {isDefense ? <Shield size={18} className="text-cyan-400" /> : <Sword size={18} className="text-orange-400" />}
                        <span className={`text-sm font-bold ${accentColors.text}`}>
                            {isDefense ? 'DEFENSE' : 'PROSECUTION'}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className={`relative z-10 max-w-[1400px] mx-auto px-4 lg:px-8 py-6 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                {/* Grid Layout - Better responsive breakpoints */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">

                    {/* Column 1: Case Summary */}
                    <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                        <div className={`px-4 py-3 ${accentColors.bgMuted} border-b border-slate-700/50 flex items-center gap-3 flex-shrink-0`}>
                            <BookOpen size={18} className={accentColors.text} />
                            <h2 className="font-bold text-sm">Case Summary</h2>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto max-h-[450px] scrollbar-thin">
                            {/* Summary Text */}
                            <div className="bg-slate-800/30 rounded-xl p-3">
                                <p className="text-[13px] text-slate-300 leading-relaxed">{caseDetails.summary}</p>
                            </div>

                            {/* Facts */}
                            {caseDetails.facts?.length > 0 && (
                                <div>
                                    <h3 className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                        <Target size={10} className={accentColors.text} />
                                        Established Facts
                                    </h3>
                                    <ul className="space-y-2">
                                        {caseDetails.facts.map((fact, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[12px]">
                                                <span className={`flex-shrink-0 w-5 h-5 rounded-md ${accentColors.bgMuted} ${accentColors.text} text-[10px] font-bold flex items-center justify-center mt-0.5`}>
                                                    {i + 1}
                                                </span>
                                                <span className="text-slate-300 leading-relaxed">{fact}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Applicable Law */}
                            {caseDetails.relevantLaw && (
                                <div className={`p-3 rounded-xl ${accentColors.bgMuted} border ${accentColors.border}`}>
                                    <p className={`text-[10px] font-bold ${accentColors.text} mb-1 uppercase tracking-wider`}>Applicable Law</p>
                                    <p className="text-[12px] text-white leading-relaxed">{caseDetails.relevantLaw}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Evidence Locker */}
                    <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                        <div className={`px-4 py-3 ${accentColors.bgMuted} border-b border-slate-700/50 flex items-center gap-3 flex-shrink-0`}>
                            <Briefcase size={18} className={accentColors.text} />
                            <h2 className="font-bold text-sm">Evidence Locker</h2>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto max-h-[450px] scrollbar-thin">
                            {/* Your Evidence */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                        <Unlock size={10} />
                                        Your Evidence
                                    </h3>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                        {caseDetails.userEvidence?.length || 0} items
                                    </span>
                                </div>
                                <ul className="space-y-1.5">
                                    {(caseDetails.userEvidence || []).map((evidence, i) => (
                                        <li key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                                            <Eye size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-[12px] text-emerald-200 leading-relaxed">{evidence}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                                <span className="text-[10px] font-black text-slate-600">VS</span>
                                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                            </div>

                            {/* Opponent Evidence */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                                        <Lock size={10} />
                                        Opponent Evidence
                                    </h3>
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                                        {caseDetails.opponentEvidence?.length || 0} items
                                    </span>
                                </div>
                                <ul className="space-y-1.5">
                                    {(caseDetails.opponentEvidence || []).map((evidence, i) => (
                                        <li key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors">
                                            <EyeOff size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-[12px] text-red-200 leading-relaxed">{evidence}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Column 3: Witness Manifest */}
                    <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                        <div className={`px-4 py-3 ${accentColors.bgMuted} border-b border-slate-700/50 flex items-center justify-between flex-shrink-0`}>
                            <div className="flex items-center gap-2">
                                <Users size={18} className={accentColors.text} />
                                <h2 className="font-bold text-sm">Witnesses</h2>
                            </div>
                            <span className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">
                                {caseDetails.witnesses?.length || 0}
                            </span>
                        </div>
                        <div className="p-3 overflow-y-auto max-h-[450px] scrollbar-thin">
                            <div className="space-y-2">
                                {(caseDetails.witnesses || []).map((witness, i) => (
                                    <div
                                        key={i}
                                        className={`p-3 rounded-xl border transition-all hover:scale-[1.01] cursor-default ${witness.affiliation === 'User'
                                            ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50'
                                            : witness.affiliation === 'Opponent'
                                                ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/50'
                                                : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/50'
                                            }`}
                                    >
                                        {/* Header Row */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            {/* Avatar */}
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${witness.affiliation === 'User'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : witness.affiliation === 'Opponent'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                <User size={16} />
                                            </div>

                                            {/* Name & Affiliation */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-[12px] text-white truncate">{witness.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{witness.role}</p>
                                            </div>

                                            {/* Badge */}
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${witness.affiliation === 'User'
                                                ? 'bg-emerald-500/30 text-emerald-300'
                                                : witness.affiliation === 'Opponent'
                                                    ? 'bg-red-500/30 text-red-300'
                                                    : 'bg-amber-500/30 text-amber-300'
                                                }`}>
                                                {witness.affiliation === 'User' ? 'ALLY' : witness.affiliation === 'Opponent' ? 'HOSTILE' : 'NEUTRAL'}
                                            </span>
                                        </div>

                                        {/* Personality - Compact */}
                                        {witness.personality && (
                                            <p className="text-[10px] text-slate-400 pl-10 line-clamp-2 leading-relaxed">
                                                <span className="text-amber-500/80 font-medium">⚡</span> {witness.personality}
                                            </p>
                                        )}
                                    </div>
                                ))}

                                {(!caseDetails.witnesses || caseDetails.witnesses.length === 0) && (
                                    <div className="text-center py-8 text-slate-600">
                                        <Users size={28} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-[11px]">No witnesses in this case</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategy Hint */}
                {caseDetails.openingHint && (
                    <div className={`mb-8 p-5 rounded-2xl ${accentColors.bgMuted} border ${accentColors.border} flex items-start gap-4 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className={`w-10 h-10 rounded-xl ${accentColors.bg} flex items-center justify-center flex-shrink-0`}>
                            <Lightbulb size={20} className="text-slate-900" />
                        </div>
                        <div>
                            <p className={`text-xs font-bold ${accentColors.text} uppercase tracking-wider mb-1`}>STRATEGIC ADVICE</p>
                            <p className="text-sm text-white">{caseDetails.openingHint}</p>
                        </div>
                    </div>
                )}

                {/* Action Bar - Sticky at bottom */}
                <div className={`backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {/* Stats as Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                            <Scale size={14} className="text-purple-400" />
                            <span className="text-[11px] font-bold text-purple-300">{caseDetails.difficulty || 'Medium'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                            <Clock size={14} className="text-emerald-400" />
                            <span className="text-[11px] font-bold text-emerald-300">Unlimited</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${accentColors.bgMuted} border ${accentColors.border}`}>
                            <FileText size={14} className={accentColors.text} />
                            <span className={`text-[11px] font-bold ${accentColors.text}`}>{caseDetails.caseStage || 'Opening'}</span>
                        </div>
                    </div>

                    {/* Enter Court Button - More prominent */}
                    <button
                        onClick={handleEnterCourt}
                        className={`group w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${accentColors.bg} text-slate-900 hover:brightness-110 shadow-lg ${accentColors.glow} hover:scale-[1.02] active:scale-[0.98]`}
                    >
                        <Zap size={18} className="group-hover:animate-pulse" />
                        <span>ENTER COURTROOM</span>
                        <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </main>
        </div>
    );
};

export default CaseBriefing;

