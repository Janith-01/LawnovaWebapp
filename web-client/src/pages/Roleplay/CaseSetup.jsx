import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Sword,
    Zap,
    Scale,
    ChevronRight,
    Loader2,
    Clock,
    Calendar,
    GraduationCap,
    Briefcase,
    Crown,
    Sparkles,
    AlertCircle,
    Play,
    Timer,
    Users,
    Target
} from 'lucide-react';

// API Configuration
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/roleplay`;

/**
 * CaseSetup - Real-Time Simulation Configuration
 * Theme: Antigravity (Dark mode, glassmorphism, neon accents)
 * 
 * Features:
 * - Defense/Prosecution role selection
 * - Time-based difficulty (replaces turns)
 * - 3-Day trial structure
 */
const CaseSetup = () => {
    const navigate = useNavigate();

    // === STATE MANAGEMENT ===
    const [selectedRole, setSelectedRole] = useState('Defense');
    const [difficulty, setDifficulty] = useState('Medium');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    // Fade in effect
    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    // Simulation Intensity configurations (Time-based)
    const intensityLevels = [
        {
            id: 'Easy',
            label: 'TRAINEE',
            icon: GraduationCap,
            timePerDay: '10 Mins',
            totalTime: '30 Mins Total',
            description: 'Slower pace. Judge is lenient.',
            features: ['Extended time to think', 'Forgiving rulings', 'Basic objections'],
            color: 'emerald',
            gradient: 'from-emerald-500 to-teal-600',
            borderColor: 'border-emerald-500',
            glowColor: 'shadow-emerald-500/30'
        },
        {
            id: 'Medium',
            label: 'ASSOCIATE',
            icon: Briefcase,
            timePerDay: '5 Mins',
            totalTime: '15 Mins Total',
            description: 'Standard Courtroom Pressure.',
            features: ['Balanced pacing', 'Fair rulings', 'Moderate objections'],
            color: 'amber',
            gradient: 'from-amber-500 to-orange-600',
            borderColor: 'border-amber-500',
            glowColor: 'shadow-amber-500/30'
        },
        {
            id: 'Hard',
            label: 'SENIOR',
            icon: Crown,
            timePerDay: '3 Mins',
            totalTime: '9 Mins Total',
            description: 'Rapid Fire. Hostile Witnesses.',
            features: ['Intense pressure', 'Strict rulings', 'Aggressive opponent'],
            color: 'rose',
            gradient: 'from-rose-500 to-red-600',
            borderColor: 'border-rose-500',
            glowColor: 'shadow-rose-500/30'
        }
    ];

    /**
     * Handle simulation initialization
     */
    const handleInitializeSimulation = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/generate-case`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userRole: selectedRole,
                    difficulty: difficulty,
                    topic: 'Random',
                    gameMode: 'TimeBased'
                })
            });

            const data = await response.json();

            if (data.success) {
                // Navigate to game interface with case data
                navigate('/roleplay/game', {
                    state: {
                        sessionId: data.data.sessionId,
                        caseDetails: data.data.caseDetails,
                        turnCount: data.data.turnCount,
                        maxTurns: data.data.maxTurns,
                        currentDay: data.data.currentDay,
                        maxDays: data.data.maxDays,
                        timeRemaining: data.data.timeRemaining,
                        timeLimitPerDay: data.data.timeLimitPerDay,
                        selectedRole: selectedRole,
                        difficulty: difficulty,
                        gameMode: 'TimeBased'
                    }
                });
            } else {
                setError(data.error || 'Failed to initialize simulation');
            }
        } catch (err) {
            console.error('API Error:', err);
            setError('Connection failed. Ensure the server is running.');
        } finally {
            setIsLoading(false);
        }
    };

    // Get accent colors based on selected role
    const roleAccent = selectedRole === 'Defense'
        ? { color: 'cyan', gradient: 'from-cyan-500 to-blue-600', glow: 'shadow-cyan-500/40' }
        : { color: 'orange', gradient: 'from-orange-500 to-red-600', glow: 'shadow-orange-500/40' };

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {/* Gradient Orbs */}
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
                {selectedRole === 'Defense' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl transition-all duration-1000" />
                )}
                {selectedRole === 'Prosecution' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-3xl transition-all duration-1000" />
                )}
                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200h60v60H0z%22%20fill%3D%22none%22%20stroke%3D%22%23ffffff%22%20stroke-opacity%3D%220.03%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
            </div>

            {/* Main Content */}
            <div className={`relative z-10 min-h-screen flex flex-col transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

                {/* Header */}
                <header className="pt-12 pb-8 px-6 text-center">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${roleAccent.gradient} flex items-center justify-center shadow-2xl ${roleAccent.glow}`}>
                            <Scale size={32} className="text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight mb-2">
                        CASE INITIALIZATION
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base">
                        Configure your simulation parameters
                    </p>

                    {/* Trial Info Badge */}
                    <div className="inline-flex items-center gap-3 mt-6 px-5 py-2.5 rounded-full bg-slate-900/60 backdrop-blur-xl border border-slate-700/50">
                        <Calendar size={16} className="text-purple-400" />
                        <span className="text-xs font-bold text-slate-300">3-DAY TRIAL</span>
                        <div className="w-px h-4 bg-slate-700" />
                        <Clock size={16} className="text-cyan-400" />
                        <span className="text-xs font-bold text-slate-300">REAL-TIME SIMULATION</span>
                    </div>
                </header>

                {/* Main Configuration Area */}
                <main className="flex-1 px-4 md:px-8 pb-8 max-w-5xl mx-auto w-full">

                    {/* Role Selection */}
                    <section className="mb-10">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-3">
                            <div className={`w-8 h-1 bg-gradient-to-r ${roleAccent.gradient} rounded-full`} />
                            SELECT YOUR SIDE
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Defense Card */}
                            <button
                                onClick={() => setSelectedRole('Defense')}
                                className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 overflow-hidden text-left ${selectedRole === 'Defense'
                                    ? 'border-cyan-500 bg-cyan-500/5 shadow-2xl shadow-cyan-500/20 scale-[1.02]'
                                    : 'border-slate-700/50 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50'
                                    }`}
                            >
                                {/* Glow Effect */}
                                {selectedRole === 'Defense' && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent" />
                                )}

                                <div className="relative flex items-start gap-5">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${selectedRole === 'Defense'
                                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/40'
                                        : 'bg-slate-800 group-hover:bg-slate-700'
                                        }`}>
                                        <Shield size={32} className={selectedRole === 'Defense' ? 'text-white' : 'text-slate-400'} />
                                    </div>

                                    <div className="flex-1">
                                        <h3 className={`text-xl font-black mb-1 ${selectedRole === 'Defense' ? 'text-cyan-300' : 'text-white'}`}>
                                            DEFENSE ATTORNEY
                                        </h3>
                                        <p className={`text-sm ${selectedRole === 'Defense' ? 'text-cyan-400/80' : 'text-slate-400'}`}>
                                            Protect the accused. Challenge the evidence.
                                        </p>

                                        {selectedRole === 'Defense' && (
                                            <div className="flex items-center gap-2 mt-3">
                                                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Selected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Prosecution Card */}
                            <button
                                onClick={() => setSelectedRole('Prosecution')}
                                className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 overflow-hidden text-left ${selectedRole === 'Prosecution'
                                    ? 'border-orange-500 bg-orange-500/5 shadow-2xl shadow-orange-500/20 scale-[1.02]'
                                    : 'border-slate-700/50 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50'
                                    }`}
                            >
                                {selectedRole === 'Prosecution' && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent" />
                                )}

                                <div className="relative flex items-start gap-5">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${selectedRole === 'Prosecution'
                                        ? 'bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/40'
                                        : 'bg-slate-800 group-hover:bg-slate-700'
                                        }`}>
                                        <Sword size={32} className={selectedRole === 'Prosecution' ? 'text-white' : 'text-slate-400'} />
                                    </div>

                                    <div className="flex-1">
                                        <h3 className={`text-xl font-black mb-1 ${selectedRole === 'Prosecution' ? 'text-orange-300' : 'text-white'}`}>
                                            PROSECUTOR
                                        </h3>
                                        <p className={`text-sm ${selectedRole === 'Prosecution' ? 'text-orange-400/80' : 'text-slate-400'}`}>
                                            Burden of proof. Secure the conviction.
                                        </p>

                                        {selectedRole === 'Prosecution' && (
                                            <div className="flex items-center gap-2 mt-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Selected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* Simulation Intensity Selection */}
                    <section className="mb-10">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-3">
                            <div className={`w-8 h-1 bg-gradient-to-r ${roleAccent.gradient} rounded-full`} />
                            SIMULATION INTENSITY
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {intensityLevels.map((level) => {
                                const isSelected = difficulty === level.id;
                                const Icon = level.icon;

                                return (
                                    <button
                                        key={level.id}
                                        onClick={() => setDifficulty(level.id)}
                                        className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${isSelected
                                            ? `${level.borderColor} bg-slate-900/50 shadow-2xl ${level.glowColor} scale-[1.02]`
                                            : 'border-slate-700/50 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50'
                                            }`}
                                    >
                                        {/* Top gradient bar */}
                                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${level.gradient} ${isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`} />

                                        <div className="relative">
                                            {/* Header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isSelected
                                                    ? `bg-gradient-to-br ${level.gradient} shadow-lg`
                                                    : 'bg-slate-800 group-hover:bg-slate-700'
                                                    }`}>
                                                    <Icon size={24} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                                </div>

                                                {isSelected && (
                                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${level.gradient} flex items-center justify-center`}>
                                                        <Zap size={14} className="text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Label */}
                                            <h3 className={`text-lg font-black mb-1 ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                                {level.label}
                                            </h3>

                                            {/* Time Info - KEY CHANGE */}
                                            <div className={`flex items-center gap-2 mb-3 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                                <Timer size={14} />
                                                <span className="text-sm font-bold">
                                                    3-Day Trial • <span className={isSelected ? '' : 'text-slate-300'}>{level.timePerDay}/Day</span>
                                                </span>
                                            </div>

                                            {/* Description */}
                                            <p className={`text-xs mb-3 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                                {level.description}
                                            </p>

                                            {/* Total Time Badge */}
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${isSelected
                                                ? `bg-gradient-to-r ${level.gradient} text-white`
                                                : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                <Clock size={10} />
                                                {level.totalTime}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 flex items-center gap-3">
                            <AlertCircle size={20} className="text-red-400 shrink-0" />
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Summary Bar */}
                    <div className="mb-6 p-4 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50">
                        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${roleAccent.gradient}`} />
                                <span className="text-slate-400">Role:</span>
                                <span className={`font-bold ${selectedRole === 'Defense' ? 'text-cyan-400' : 'text-orange-400'}`}>
                                    {selectedRole}
                                </span>
                            </div>
                            <div className="w-px h-5 bg-slate-700" />
                            <div className="flex items-center gap-2">
                                <Target size={14} className="text-slate-400" />
                                <span className="text-slate-400">Intensity:</span>
                                <span className="font-bold text-white">{intensityLevels.find(l => l.id === difficulty)?.label}</span>
                            </div>
                            <div className="w-px h-5 bg-slate-700" />
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-slate-400" />
                                <span className="text-slate-400">Time:</span>
                                <span className="font-bold text-white">{intensityLevels.find(l => l.id === difficulty)?.timePerDay}/Day</span>
                            </div>
                        </div>
                    </div>

                    {/* Initialize Button */}
                    <button
                        onClick={handleInitializeSimulation}
                        disabled={isLoading}
                        className={`w-full py-6 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 ${!isLoading
                            ? `bg-gradient-to-r ${roleAccent.gradient} text-white hover:brightness-110 shadow-2xl ${roleAccent.glow} hover:scale-[1.01] active:scale-[0.99] animate-pulse`
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                        style={!isLoading ? { animationDuration: '3s' } : {}}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                <span>GENERATING CASE...</span>
                            </>
                        ) : (
                            <>
                                <Play size={24} />
                                <span>INITIALIZE SIMULATION</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>

                    {/* Footer */}
                    <div className="mt-8 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Powered by Gemini AI</span>
                        </div>
                        <div className="w-px h-3 bg-slate-700" />
                        <span className="text-slate-500 text-[10px]">Sri Lankan Law Curriculum</span>
                        <div className="w-px h-3 bg-slate-700" />
                        <span className="text-slate-500 text-[10px]">Real-Time Simulation</span>
                    </div>
                </main>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50">
                    <div className="text-center">
                        {/* Spinning rings */}
                        <div className="relative w-32 h-32 mx-auto mb-8">
                            <div className={`absolute inset-0 border-4 ${selectedRole === 'Defense' ? 'border-cyan-500/30' : 'border-orange-500/30'} rounded-full animate-ping`} />
                            <div className={`absolute inset-2 border-4 ${selectedRole === 'Defense' ? 'border-cyan-500/50' : 'border-orange-500/50'} border-t-transparent rounded-full animate-spin`} />
                            <div className="absolute inset-4 border-4 border-purple-500/50 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Scale size={40} className={`${selectedRole === 'Defense' ? 'text-cyan-400' : 'text-orange-400'} animate-pulse`} />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2 font-serif">Preparing Courtroom</h2>
                        <p className="text-slate-400 text-sm mb-2">Generating case dossier...</p>
                        <p className="text-slate-500 text-xs">3-Day Trial • {intensityLevels.find(l => l.id === difficulty)?.timePerDay}/Day</p>

                        {/* Progress dots */}
                        <div className="flex justify-center gap-2 mt-6">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full bg-gradient-to-r ${roleAccent.gradient} animate-bounce`}
                                    style={{ animationDelay: `${i * 0.2}s` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaseSetup;
