import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Send,
    Scale,
    User,
    Gavel,
    ArrowLeft,
    Sparkles,
    Crown,
    Trophy,
    XCircle,
    Shield,
    Sword,
    Users,
    AlertTriangle,
    BookOpen,
    Info,
    History,
    FileText,
    ExternalLink,
    Clock,
    Calendar,
    Mic,
    MicOff,
    Volume2,
    FolderOpen,
    ChevronRight,
    X,
    StopCircle,
    FastForward,
    BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import EvidenceModal from '../../components/Roleplay/EvidenceModal';
import io from 'socket.io-client';

// API Configuration - Points to Node.js Backend
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/roleplay`;


const GameInterface = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Get case data from navigation state
    const { sessionId: initialSessionId, caseDetails, maxTurns: initialMaxTurns, selectedRole } = location.state || {};

    // === STATE MANAGEMENT ===
    const [sessionId, setSessionId] = useState(initialSessionId || null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [turnCount, setTurnCount] = useState(0);
    const [winProbability, setWinProbability] = useState(50);
    const [gameStatus, setGameStatus] = useState('active');
    const [verdict, setVerdict] = useState(null);
    const [auditReport, setAuditReport] = useState(null);
    const [citedLaws, setCitedLaws] = useState([]);
    const [currentSpeakerRole, setCurrentSpeakerRole] = useState('Judge');
    const [currentSpeakerName, setCurrentSpeakerName] = useState('Judge Dissanayake');
    const [isObjectionPending, setIsObjectionPending] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const baseTextRef = useRef('');
    const latestInputTextRef = useRef(inputText);
    const retryCountRef = useRef(0);
    const socketRef = useRef(null);
    const { isDarkMode } = useTheme();

    // HUD State
    const [currentDay, setCurrentDay] = useState(1);
    const [maxDays, setMaxDays] = useState(3);
    const [timeRemaining, setTimeRemaining] = useState(240); // 4 minutes per day
    const [activeWitness, setActiveWitness] = useState(null);

    // Multi-Day Navigation State
    const [isDayComplete, setIsDayComplete] = useState(false); // Tracks if current day tasks are finished
    const [showDayTransition, setShowDayTransition] = useState(false); // For transition animation
    const [minTurnsRequirement, setMinTurnsRequirement] = useState(3); // Minimum turns before day can be completed manually

    // Evidence Modal State
    const [showDossierModal, setShowDossierModal] = useState(false);

    // Confirmation state for toast-based exit confirm
    const [exitConfirmPending, setExitConfirmPending] = useState(false);

    // End Trial Modal State
    const [showEndTrialModal, setShowEndTrialModal] = useState(false);
    const [endTrialLoading, setEndTrialLoading] = useState(false);

    // Refs
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);

    // Case Info from navigation state or defaults
    const caseInfo = {
        title: caseDetails?.title || "Practice Case",
        stage: caseDetails?.caseStage || caseDetails?.relevantLaw || "Cross-Examination",
        summary: caseDetails?.summary || null,
        userRole: selectedRole || caseDetails?.userRole || "Defense",
        maxTurns: initialMaxTurns || 5
    };

    // Timer countdown effect
    useEffect(() => {
        if (gameStatus !== 'active' || timeRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeRemaining(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStatus, timeRemaining]);

    // Initialize with session data or opening message
    useEffect(() => {
        const loadSession = async () => {
            if (!sessionId) {
                // Initial opening message for new sessions
                const openingMessage = caseDetails?.summary
                    ? `Order in the court! This case involves: ${caseDetails.summary}\n\nYou are appearing as ${caseInfo.userRole} Counsel. Present your arguments with conviction.`
                    : 'Order in the court! This session is now in progress. Present your arguments with conviction, Counsel.';

                setMessages([{
                    id: 1,
                    type: 'ai',
                    speaker: 'Judge Dissanayake',
                    speakerRole: 'Judge',
                    content: openingMessage,
                    mood: 'Neutral',
                    action: 'Instruction',
                    timestamp: new Date()
                }]);
                return;
            }

            try {
                setIsLoading(true);
                const response = await fetch(`${API_BASE_URL}/session/${sessionId}`);
                const data = await response.json();

                if (data.success && data.data) {
                    const session = data.data;
                    
                    // Map history to UI messages
                    const mappedMessages = session.history.map((h, index) => ({
                        id: h._id || index,
                        type: h.role === 'model' ? 'ai' : 'user',
                        speaker: h.speaker,
                        speakerRole: h.speakerRole,
                        content: h.content,
                        mood: h.mood,
                        action: h.action,
                        winProbability: h.winProbability,
                        timestamp: h.timestamp || new Date()
                    }));

                    if (mappedMessages.length > 0) {
                        setMessages(mappedMessages);
                    } else {
                        // Fallback opening if history is empty
                        setMessages([{
                            id: 1,
                            type: 'ai',
                            speaker: 'Judge Dissanayake',
                            speakerRole: 'Judge',
                            content: 'The court is now in session. Please state your name and role.',
                            mood: 'Neutral',
                            action: 'Instruction',
                            timestamp: new Date()
                        }]);
                    }

                    if (session.currentWinProbability !== undefined) {
                      setWinProbability(Number(session.currentWinProbability));
                    }
                    if (session.turnCount !== undefined) setTurnCount(session.turnCount);
                    if (session.currentDay !== undefined) setCurrentDay(session.currentDay);
                }
            } catch (err) {
                console.error("Failed to load session:", err);
                toast.error("Network error: Could not restore previous session.");
            } finally {
                setIsLoading(false);
            }
        };

        loadSession();
    }, [sessionId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages, isLoading]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // === SOCKET.IO INTEGRATION FOR AUTONOMOUS COURTROOM ===
    useEffect(() => {
        if (!sessionId) return;

        // Initialize socket connection
        const SOCKET_URL = import.meta.env.VITE_ROLEPLAY_WS_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api/roleplay', '') || 'http://localhost:5000';
        socketRef.current = io(SOCKET_URL, {
            path: '/roleplay-socket',
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('🔌 Connected to Courtroom Socket:', socket.id);
            socket.emit('join-session', sessionId);
        });

        // Listen for autonomous AI dialogue
        socket.on('ai-dialogue', (aiMessage) => {
            console.log('⚖️ Autonomous Dialogue Received:', aiMessage);

            setMessages(prev => {
                // Prevent duplicates if by some chance the same message arrives via multiple paths
                if (prev.some(m => m.id === aiMessage.id)) return prev;
                return [...prev, aiMessage];
            });

            // Update UI state
            if (aiMessage.speakerRole) setCurrentSpeakerRole(aiMessage.speakerRole);
            if (aiMessage.speaker) setCurrentSpeakerName(aiMessage.speaker);
            
            // Update Merit Bar synchronously with autonomous dialogue
            if (aiMessage.winProbability !== undefined) {
                setWinProbability(Number(aiMessage.winProbability));
            }

            // If it's a verdict, handle redirection
            if (aiMessage.action === 'VERDICT') {
                toast.success('The Judge is delivering the final verdict...');
                setTimeout(() => navigate(`/results/${sessionId}`), 5000);
            }
        });

        // Listen for Objection Rulings
        socket.on('objection-ruling', (ruling) => {
            console.log('🔨 Objection Ruling:', ruling);
            setMessages(prev => [...prev, ruling]);
            setCurrentSpeakerRole('Judge');
            setCurrentSpeakerName('Judge Dissanayake');
            setIsObjectionPending(false);
            setIsLoading(false);
            toast.info(`Judge Ruling: ${ruling.content.substring(0, 30)}...`);
        });

        // Cleanup on unmount
        return () => {
            if (socket) {
                socket.emit('leave-session', sessionId);
                socket.disconnect();
            }
        };
    }, [sessionId]);

    // Keep latest input text in a ref to avoid stale closures in recognition handlers
    useEffect(() => {
        latestInputTextRef.current = inputText;
    }, [inputText]);

    // Track user activity to reset heartbeat
    useEffect(() => {
        if (!socketRef.current || !sessionId) return;

        if (isListening) {
            // Crucial: Pause the autonomous heartbeat while user is dictating argument
            socketRef.current.emit('pause-heartbeat', sessionId);
        } else {
            // Resume heartbeat when mic is off
            socketRef.current.emit('resume-heartbeat', sessionId);
            if (inputText.length > 0) {
                socketRef.current.emit('user-active', sessionId);
            }
        }
    }, [isListening, inputText, sessionId]);

    // === SPEECH RECOGNITION INITIALIZATION ===
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            baseTextRef.current = latestInputTextRef.current;
            console.log("🎤 Voice input active...");
        };

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            // Real-time transcript update
            setInputText(baseTextRef.current + (baseTextRef.current ? ' ' : '') + transcript);
        };

        recognition.onerror = (event) => {
            // "no-speech" is common and not always a failure
            if (event.error === 'no-speech') {
                console.debug('Speech recognition: no speech detected.');
                setIsListening(false);
            } else if (event.error === 'network') {
                console.warn('Speech recognition network error. Retrying...');
                // Try to restart if it's a network glitch
                if (retryCountRef.current < 2) {
                    retryCountRef.current += 1;
                    setTimeout(() => {
                        try {
                            recognitionRef.current?.start();
                        } catch (e) {
                            console.error("Retry failed:", e);
                            setIsListening(false);
                        }
                    }, 1000);
                } else {
                    console.error('Speech recognition: Permanent network error.');
                    toast.error("Vocal connection unstable. Try typing your argument.");
                    setIsListening(false);
                }
            } else {
                console.error('Speech recognition error:', event.error);
                toast.error(`Mic error: ${event.error}`);
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            // Reset retry count if we ended normally (no error)
            if (isListening && !recognitionRef.current?.lastError) {
                retryCountRef.current = 0;
            }

            setIsListening(false);
            console.log("🎤 Voice input stopped.");

            // Auto-send argument if something was captured
            const finalInput = latestInputTextRef.current;
            if (finalInput.trim() && finalInput !== baseTextRef.current) {
                setTimeout(() => {
                    handleSendMessage();
                }, 500);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [sessionId]); // Removed inputText dependency

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            try {
                recognitionRef.current?.start();
            } catch (err) {
                console.error("Mic start failed:", err);
            }
        }
    };

    // Check if current day is complete (minimum turns requirement met)
    useEffect(() => {
        if (currentDay < maxDays && turnCount >= minTurnsRequirement * currentDay) {
            setIsDayComplete(true);
        } else {
            setIsDayComplete(false);
        }
    }, [turnCount, currentDay, maxDays, minTurnsRequirement]);

    /**
     * Manual Day Progression Handler
     * Allows user to proceed to next day before time runs out
     */
    const handleProceedToNextDay = async () => {
        if (currentDay >= maxDays) return;

        try {
            // Notify backend about day progression if we have a session
            if (sessionId) {
                await fetch(`${API_BASE_URL}/session/${sessionId}/advance-day`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Show transition animation
            setShowDayTransition(true);

            setTimeout(() => {
                // Move to next day
                const nextDay = currentDay + 1;
                setCurrentDay(nextDay);
                setTimeRemaining(360); // Reset timer to 6 minutes
                setIsDayComplete(false);

                // Add system message for day transition
                const transitionMessage = {
                    id: Date.now(),
                    type: 'ai',
                    speaker: 'Judge Dissanayake',
                    speakerRole: 'Judge',
                    content: `*The gavel strikes* Court is adjourned for today. We will reconvene tomorrow for Day ${nextDay}.\n\n📅 **Day ${nextDay} of ${maxDays}** - The court is now back in session. Counsel, you may proceed.`,
                    mood: 'Formal',
                    action: 'Adjourn',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, transitionMessage]);

                // Toast notification
                toast.success(`Day ${nextDay} has begun!`, {
                    description: `You have 6 minutes to present your arguments.`,
                    duration: 4000
                });

                // Hide transition
                setTimeout(() => {
                    setShowDayTransition(false);
                }, 500);
            }, 1000);
        } catch (error) {
            console.error("Failed to advance day:", error);
            toast.error("Failed to advance trial day. Please try again.");
        }
    };

    /**
     * End Trial Handler
     * Allows user to end the trial early and get a verdict
     */
    const handleEndTrial = async () => {
        setEndTrialLoading(true);
        setShowEndTrialModal(false);
        const TRIAL_API_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/trials`;

        // Add system message
        const endingMessage = {
            id: Date.now(),
            type: 'ai',
            speaker: 'Court Clerk',
            speakerRole: 'Clerk',
            content: '⚖️ The trial is concluding. The court will now compile its verdict and audit the transcripts...',
            mood: 'Formal',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, endingMessage]);

        try {
            // Request finalization from the new audit orchestration engine
            const response = await fetch(`${TRIAL_API_URL}/${sessionId}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success && data.redirectUrl) {
                toast.success('Trial concluded. Processing final audit report...');
                setTimeout(() => {
                    navigate(data.redirectUrl);
                }, 1500);
            } else {
                toast.error(data.message || 'Error compiling audit report.');
                setEndTrialLoading(false);
            }
        } catch (error) {
            console.error('Error ending trial:', error);
            toast.error('Network error during finalization.');
            setEndTrialLoading(false);
        }
    };


    /**
     * Format time as MM:SS
     */
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getClockColor = () => {
        if (timeRemaining <= 30) return 'text-red-500 animate-pulse';
        if (timeRemaining <= 60) return 'text-yellow-400';
        return 'text-emerald-400';
    };

    /**
     * Get clock glow based on time
     */
    const getClockGlow = () => {
        if (timeRemaining <= 30) return 'shadow-red-500/50';
        if (timeRemaining <= 60) return 'shadow-yellow-500/30';
        return 'shadow-emerald-500/30';
    };

    /**
     * Handle sending a message
     */
    const handleSendMessage = async () => {
        const trimmedText = inputText.trim();
        if (!trimmedText || isLoading || gameStatus === 'finished') return;

        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: trimmedText,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmedText,
                    sessionId: sessionId
                })
            });

            const data = await response.json();

            if (data.success && data.data) {
                const {
                    ai_reply,
                    win_probability,
                    speaker,
                    speakerRole,
                    mood,
                    action,
                    relevant_laws,
                    sessionId: returnedSessionId,
                    turnCount: newTurnCount,
                    status,
                    verdict_data,  // New: Full verdict object with outcome, reasoning, etc.
                    auditReport: auditData,  // Argument audit results from BERT model
                    currentDay: newDay,
                    maxDays: newMaxDays,
                    timeRemaining: newTimeRemaining
                } = data.data;

                if (returnedSessionId && !sessionId) {
                    setSessionId(returnedSessionId);
                }

                // Update day tracking and handle day transitions
                if (newDay && newDay !== currentDay) {
                    console.log(`📅 Day changed: ${currentDay} → ${newDay}`);
                    setCurrentDay(newDay);
                    // Reset timer for new day (4 minutes = 240 seconds)
                    setTimeRemaining(newTimeRemaining || 240);
                } else if (newTimeRemaining !== undefined) {
                    setTimeRemaining(newTimeRemaining);
                }

                if (newMaxDays) setMaxDays(newMaxDays);

                // Update active witness if speaking
                if (speakerRole === 'Witness' && speaker) {
                    const witnessInfo = caseDetails?.witnesses?.find(w =>
                        w.name.toLowerCase().includes(speaker.toLowerCase().split(' ')[0])
                    );
                    setActiveWitness(witnessInfo || { name: speaker, role: 'Witness' });
                }

                // Add to cited laws if present and new
                if (relevant_laws) {
                    setCitedLaws(prev => {
                        const exists = prev.some(law => law.content === relevant_laws);
                        if (!exists) {
                            return [...prev, {
                                id: Date.now(),
                                content: relevant_laws,
                                speaker: speaker || 'Judge',
                                turn: newTurnCount || turnCount + 1
                            }];
                        }
                        return prev;
                    });
                }

                // Handle VERDICT action - Redirect to results page
                if (action === 'VERDICT' && verdict_data) {
                    console.log('⚖️ FINAL VERDICT RECEIVED:', verdict_data);
                    setGameStatus('finished');
                    setVerdict(verdict_data);
                    if (auditData) setAuditReport(auditData);
                    setIsLoading(false);

                    toast.success('Trial finished. Compiling audit report...');
                    setTimeout(() => {
                        navigate(`/results/${sessionId}`);
                    }, 2500);

                    // Add the verdict as the final message
                    const verdictMessage = {
                        id: Date.now() + 1,
                        type: 'ai',
                        speaker: 'Judge Dissanayake',
                        speakerRole: 'Judge',
                        content: ai_reply,
                        mood: 'Authoritative',
                        action: 'VERDICT',
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, verdictMessage]);
                    return; // Early return - don't process further
                }

                setTimeout(() => {
                    const aiMessage = {
                        id: Date.now() + 1,
                        type: 'ai',
                        speaker: speaker || 'Judge Dissanayake',
                        speakerRole: speakerRole || 'Judge',
                        content: ai_reply,
                        mood: mood,
                        action: action,
                        relevantLaws: relevant_laws,
                        winProbability: win_probability,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, aiMessage]);
                    if (win_probability !== undefined) setWinProbability(Number(win_probability));
                    setTurnCount(newTurnCount || turnCount + 1);
                    setCurrentSpeakerRole(speakerRole || 'Judge');
                    setCurrentSpeakerName(speaker || 'Judge Dissanayake');
                    setIsLoading(false);

                    // Handle game over (fallback for non-VERDICT finish)
                    if (status === 'finished' && verdict_data) {
                        setGameStatus('finished');
                        setVerdict(verdict_data);
                    }

                    // Handle adjournment - show a toast/notification if needed
                    if (action === 'ADJOURN') {
                        console.log(`⚖️ Court adjourned! Now on Day ${newDay}`);
                    }
                }, 300);
            } else {
                handleError('The court reporter encountered an error. Please try again.');
            }
        } catch (error) {
            console.error('API Error:', error);
            handleError('Connection to the court failed. Please ensure the server is running.');
        }
    };

    /**
     * Handle Objection Trigger
     */
    const handleObjection = () => {
        if (!sessionId || isObjectionPending) return;

        setIsObjectionPending(true);
        setIsLoading(true);

        // Add user objection message locally immediately
        const objMsg = {
            id: Date.now(),
            type: 'user',
            content: 'OBJECTION, YOUR HONOR!',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, objMsg]);

        // Emit to backend via Socket
        if (socketRef.current) {
            socketRef.current.emit('objection', {
                sessionId,
                objectionText: "I object to this line of reasoning!"
            });
        }
    };

    const handleError = (msg) => {
        setMessages(prev => [...prev, {
            id: Date.now() + 1,
            type: 'system',
            content: msg,
            timestamp: new Date()
        }]);
        setIsLoading(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getProbabilityColor = () => {
        if (winProbability >= 70) return 'from-green-400 to-emerald-500';
        if (winProbability >= 40) return 'from-amber-400 to-orange-500';
        return 'from-red-400 to-rose-500';
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-3xl" />
                {/* Hexagonal grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
                    backgroundSize: '60px 60px'
                }} />
            </div>

            {/* === ANTIGRAVITY HUD === */}
            <header className="relative z-20 shrink-0">
                {/* Top Accent Line */}
                <div className="h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

                <div className="px-4 py-3 backdrop-blur-xl bg-slate-900/70 border-b border-slate-800/50">
                    <div className="max-w-[1600px] mx-auto">

                        {/* Main HUD Bar */}
                        <div className="flex items-center justify-between gap-4">

                            {/* Exit Button */}
                            <button
                                onClick={() => {
                                    // Toast-based confirmation (double-click pattern)
                                    if (!exitConfirmPending) {
                                        setExitConfirmPending(true);
                                        toast.warning('Click EXIT again to confirm leaving. Progress will be saved.');

                                        setTimeout(() => setExitConfirmPending(false), 3000);
                                        return;
                                    }

                                    // User confirmed - exit
                                    setExitConfirmPending(false);
                                    navigate('/roleplay');
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-transparent hover:border-red-500/50"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-sm font-bold hidden sm:inline">EXIT</span>
                            </button>

                            {/* HUD Instrument Panels */}
                            <div className="flex-1 flex items-center justify-center gap-4">

                                {/* Section A: Day Counter */}
                                <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                                    <Calendar size={18} className="text-cyan-400" />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-cyan-400/70 uppercase tracking-widest">Trial Day</span>
                                        <span className="text-lg font-black font-mono text-cyan-400 tracking-wider">
                                            {currentDay} <span className="text-cyan-600">/</span> {maxDays}
                                        </span>
                                    </div>
                                </div>

                                {/* Section B: Court Clock */}
                                <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 shadow-2xl ${getClockGlow()}`}>
                                    <Clock size={24} className={getClockColor()} />
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Time Remaining</span>
                                        <span className={`text-3xl font-black font-mono tracking-[0.15em] ${getClockColor()}`}>
                                            {formatTime(timeRemaining)}
                                        </span>
                                    </div>
                                    {/* Active Speaker Badge */}
                                    <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-lg flex flex-col items-center min-w-[120px]">
                                        <div className="text-[9px] text-slate-500 font-bold tracking-widest mb-1 uppercase">Currently Speaking</div>
                                        <div className={`text-sm font-bold ${currentSpeakerRole === 'Judge' ? 'text-yellow-400' :
                                            currentSpeakerRole === 'Prosecutor' || currentSpeakerRole === 'Opponent' ? 'text-red-400' :
                                                currentSpeakerRole === 'DefenseAttorney' ? 'text-cyan-400' :
                                                    currentSpeakerRole === 'Witness' ? 'text-blue-400' :
                                                        currentSpeakerRole === 'Clerk' ? 'text-slate-400' :
                                                            'text-purple-400'
                                            }`}>
                                            {currentSpeakerName || 'Waiting...'}
                                        </div>
                                    </div>
                                </div>

                                {/* Section C: Active Witness Badge */}
                                <div className="hidden md:flex items-center gap-3 px-5 py-2.5 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-slate-600/30 shadow-lg">
                                    {activeWitness ? (
                                        <>
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-cyan-500/30">
                                                <User size={18} className="text-cyan-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-cyan-400/70 uppercase tracking-widest">On Stand</span>
                                                <span className="text-sm font-bold text-white truncate max-w-[120px]">{activeWitness.name}</span>
                                                <span className="text-[10px] text-slate-500">{activeWitness.role}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                                <Users size={18} className="text-slate-600" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Witness</span>
                                                <span className="text-xs font-bold text-slate-500">NO WITNESS ON STAND</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Role Badge & Game Actions */}
                            <div className="flex items-center gap-2">
                                {/* End Trial Early Button */}
                                {gameStatus === 'active' && (
                                    <button
                                        onClick={() => setShowEndTrialModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all group"
                                        title="Conclude trial early and get verdict"
                                    >
                                        <StopCircle size={18} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-black hidden lg:inline">END TRIAL</span>
                                    </button>
                                )}

                                {/* Next Day Button */}
                                {gameStatus === 'active' && currentDay < maxDays && (
                                    <button
                                        onClick={handleProceedToNextDay}
                                        disabled={!isDayComplete && turnCount < 5} // Requirement: 5 turns or isDayComplete
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all group ${(!isDayComplete && turnCount < 5)
                                            ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700'
                                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                            }`}
                                        title={(!isDayComplete && turnCount < 5) ? `Complete more turns to proceed (${turnCount}/5)` : "Proceed to next trial day"}
                                    >
                                        <FastForward size={18} className="group-hover:translate-x-1 transition-transform" />
                                        <span className="text-xs font-black hidden lg:inline">NEXT DAY</span>
                                    </button>
                                )}

                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${caseInfo.userRole === 'Defense'
                                    ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                                    : 'border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/20'
                                    }`}>
                                    {caseInfo.userRole === 'Defense'
                                        ? <Shield size={18} className="text-cyan-400" />
                                        : <Sword size={18} className="text-orange-400" />
                                    }
                                    <span className={`text-xs font-black ${caseInfo.userRole === 'Defense' ? 'text-cyan-400' : 'text-orange-400'
                                        }`}>
                                        {caseInfo.userRole.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Win Probability Bar */}
                        <div className="mt-3 flex items-center gap-3">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Legal Merit</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-800/80 backdrop-blur">
                                <div
                                    className={`h-full bg-gradient-to-r ${getProbabilityColor()} transition-all duration-700 shadow-lg`}
                                    style={{ width: `${winProbability}%` }}
                                />
                            </div>
                            <span className={`text-sm font-black font-mono ${winProbability >= 70 ? 'text-green-400' : winProbability >= 40 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                {winProbability.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* === MAIN CONTENT === */}
            <div className="flex-1 flex overflow-hidden relative z-10">

                {/* Left Sidebar - Case Info (Collapsible on smaller screens) */}
                <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
                    <div className="p-5 space-y-5 overflow-y-auto">
                        {/* Case Title */}
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50">
                            <h2 className="font-serif font-bold text-lg leading-tight mb-2">{caseInfo.title}</h2>
                            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                {caseInfo.stage}
                            </span>
                        </div>

                        {/* Case Summary */}
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                <Info size={12} /> Case Brief
                            </h3>
                            <div className="text-xs leading-relaxed text-slate-400 p-4 rounded-xl bg-slate-800/30 border border-slate-800/50">
                                {caseInfo.summary || "Reviewing the case documents..."}
                            </div>
                        </div>

                        {/* Witnesses */}
                        {caseDetails?.witnesses?.length > 0 && (
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                    <Users size={12} /> Witnesses
                                </h3>
                                <div className="space-y-2">
                                    {caseDetails.witnesses.map((w, i) => (
                                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${activeWitness?.name === w.name
                                            ? 'bg-cyan-500/10 border-cyan-500/50'
                                            : 'bg-slate-800/20 border-slate-800/50 hover:border-slate-700'
                                            }`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${w.affiliation === 'User' ? 'bg-emerald-500/20 text-emerald-400' :
                                                w.affiliation === 'Opponent' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-slate-700 text-slate-400'
                                                }`}>
                                                <User size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold truncate">{w.name}</p>
                                                <p className="text-[10px] text-slate-500">{w.role}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* === MAIN CHAT AREA - THE BATTLEGROUND === */}
                <main className="flex-1 flex flex-col relative overflow-hidden">
                    <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
                    >
                        <div className="max-w-4xl mx-auto space-y-6">
                            {messages.map((message) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    userRole={caseInfo.userRole}
                                />
                            ))}

                            {/* Loading Animation */}
                            {isLoading && (
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10 border border-amber-500/30 animate-pulse">
                                        <Gavel size={22} className="text-amber-400" />
                                    </div>
                                    <div className="px-6 py-4 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50">
                                        <div className="flex gap-2">
                                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* === INPUT ZONE === */}
                    <div className="p-4 backdrop-blur-xl bg-slate-900/80 border-t border-slate-800/50">
                        <div className="max-w-4xl mx-auto">
                            {gameStatus === 'finished' ? (
                                <div className="flex justify-center py-2">
                                    <button
                                        onClick={() => navigate('/roleplay')}
                                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-2xl shadow-purple-500/30 active:scale-95"
                                    >
                                        <Sparkles size={20} />
                                        NEW SESSION
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Present your argument to the court..."
                                            disabled={isLoading}
                                            className="w-full px-6 py-4 pr-14 rounded-2xl border-2 bg-slate-900/50 border-slate-700/50 text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-sm backdrop-blur-xl"
                                        />
                                        <button
                                            onClick={toggleListening}
                                            disabled={isLoading}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all z-10 ${isListening
                                                ? 'text-red-500 animate-pulse bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500/50'
                                                : 'text-slate-500 hover:text-purple-400 hover:bg-purple-500/10'
                                                }`}
                                            title={isListening ? "Stop listening" : "Speak your argument"}
                                        >
                                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                            {isListening && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleObjection}
                                        disabled={isLoading || isObjectionPending}
                                        className={`px-5 rounded-2xl font-black text-[10px] tracking-tighter transition-all flex flex-col items-center justify-center gap-0.5 border-2 ${isObjectionPending
                                            ? 'bg-red-500/20 border-red-500/50 text-red-500'
                                            : 'bg-black/40 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-500'
                                            }`}
                                    >
                                        <AlertTriangle size={18} />
                                        OBJECTION
                                    </button>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputText.trim() || isLoading}
                                        className={`px-6 rounded-2xl flex items-center justify-center transition-all ${inputText.trim() && !isLoading
                                            ? 'bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95'
                                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                            }`}
                                    >
                                        <Send size={20} fill={inputText.trim() && !isLoading ? "currentColor" : "none"} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - Cited Laws */}
                <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
                    <div className="p-4 border-b border-slate-800/50">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <History size={12} /> Legal Citations
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {citedLaws.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center">
                                <BookOpen size={32} className="text-slate-700 mb-3" />
                                <p className="text-xs text-slate-600">No laws cited yet.</p>
                                <p className="text-[10px] text-slate-700">Citations will appear here.</p>
                            </div>
                        ) : (
                            citedLaws.map((law) => (
                                <div
                                    key={law.id}
                                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-purple-500/30 transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase">
                                            Turn {law.turn}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-600">
                                            {law.speaker}
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-mono leading-relaxed text-slate-400 line-clamp-4">
                                        {law.content}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            </div>

            {/* === VERDICT MODAL - ENHANCED WITH FULL LEGAL DETAILS === */}
            {gameStatus === 'finished' && verdict && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900/95 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-hidden backdrop-blur-xl">
                        {/* Top accent - color based on verdict */}
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${verdict.outcome === 'Guilty'
                            ? 'bg-gradient-to-r from-red-500 via-rose-600 to-red-500'
                            : verdict.outcome === 'Not Guilty'
                                ? 'bg-gradient-to-r from-green-500 via-emerald-600 to-green-500'
                                : 'bg-gradient-to-r from-amber-500 via-yellow-600 to-amber-500'
                            }`} />

                        {/* Verdict Icon */}
                        <div className={`w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl ${verdict.outcome === 'Guilty'
                            ? 'bg-red-500/20 text-red-400 shadow-red-500/30'
                            : verdict.outcome === 'Not Guilty'
                                ? 'bg-green-500/20 text-green-400 shadow-green-500/30'
                                : 'bg-amber-500/20 text-amber-400 shadow-amber-500/30'
                            }`}>
                            {verdict.outcome === 'Guilty' ? <XCircle size={48} /> :
                                verdict.outcome === 'Not Guilty' ? <Trophy size={48} /> :
                                    <Scale size={48} />}
                        </div>

                        {/* Verdict Outcome */}
                        <h2 className={`text-3xl font-black font-serif text-center mb-2 tracking-tight ${verdict.outcome === 'Guilty' ? 'text-red-400' :
                            verdict.outcome === 'Not Guilty' ? 'text-green-400' : 'text-amber-400'
                            }`}>
                            {verdict.outcome?.toUpperCase() || 'VERDICT DELIVERED'}
                        </h2>

                        {/* Confidence Score */}
                        {verdict.confidence_score && (
                            <div className="flex justify-center mb-4">
                                <span className={`px-4 py-1.5 rounded-full text-xs font-black border ${verdict.confidence_score >= 70
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                                    }`}>
                                    COURT CONFIDENCE: {verdict.confidence_score}%
                                </span>
                            </div>
                        )}

                        {/* Judge's Statement */}
                        <div className="bg-slate-800/50 rounded-2xl p-4 mb-4 border border-slate-700/50">
                            <p className="text-sm text-center leading-relaxed text-slate-300 italic">
                                "{verdict.judge_statement || verdict.reasoning}"
                            </p>
                        </div>

                        {/* Reasoning (if different from statement) */}
                        {verdict.reasoning && verdict.reasoning !== verdict.judge_statement && (
                            <div className="mb-4">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">LEGAL REASONING</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {verdict.reasoning}
                                </p>
                            </div>
                        )}

                        {/* Legal Citation */}
                        {verdict.citation && (
                            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-500/10 rounded-xl border border-purple-500/30">
                                <FileText size={14} className="text-purple-400 shrink-0" />
                                <span className="text-xs text-purple-300 font-mono">{verdict.citation}</span>
                            </div>
                        )}

                        {/* Sentence (if Guilty) */}
                        {verdict.outcome === 'Guilty' && verdict.sentence && verdict.sentence !== 'None' && (
                            <div className="bg-red-500/10 rounded-xl p-3 mb-6 border border-red-500/30">
                                <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">SENTENCE</h4>
                                <p className="text-sm text-red-300 font-bold">{verdict.sentence}</p>
                            </div>
                        )}

                        {/* Formal Judgment Button */}
                        {verdict.formal_judgment && (
                            <button
                                onClick={() => {
                                    // Open full judgment in modal or new view
                                    setShowDossierModal(true); // Reuse dossier modal or create new one
                                }}
                                className="w-full mb-4 py-3 px-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-amber-500/30 hover:border-amber-400/50 text-amber-400 hover:text-amber-300 flex items-center justify-center gap-2 transition-all font-bold text-sm group"
                            >
                                <FileText size={16} className="group-hover:scale-110 transition-transform" />
                                VIEW FULL FORMAL JUDGMENT
                                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-3 mt-6">
                            {/* VIEW AUDIT REPORT - Primary CTA */}
                            {auditReport && auditReport.arguments?.length > 0 && (
                                <button
                                    onClick={() => navigate('/roleplay/audit-report', {
                                        state: {
                                            auditReport,
                                            verdictData: verdict,
                                            sessionId,
                                            caseTitle: caseInfo.title
                                        }
                                    })}
                                    className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                                >
                                    <BarChart3 size={18} />
                                    VIEW AUDIT REPORT
                                    <span className="text-[10px] font-bold bg-slate-950/20 px-2 py-0.5 rounded-md">
                                        {auditReport.totalArguments} ARGS
                                    </span>
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setGameStatus('reviewing')}
                                    className="py-4 rounded-2xl font-black text-xs transition-all border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
                                >
                                    REVIEW TRANSCRIPT
                                </button>
                                <button
                                    onClick={() => navigate('/roleplay')}
                                    className="py-4 rounded-2xl font-black text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 active:scale-95 transition-all"
                                >
                                    NEW CASE
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Full Formal Judgment Overlay */}
                    {verdict.formal_judgment && showDossierModal && gameStatus === 'finished' && (
                        <div
                            className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[60] p-6"
                            onClick={() => setShowDossierModal(false)}
                        >
                            <div
                                className="bg-slate-900 border-2 border-amber-500/30 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                                            <Gavel className="w-6 h-6 text-slate-900" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white">Final Judgment</h2>
                                            <p className="text-sm text-slate-400">High Court of Sri Lanka</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowDossierModal(false)}
                                        className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>

                                {/* Judgment Content */}
                                <div className="prose prose-invert prose-amber max-w-none">
                                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 whitespace-pre-wrap font-serif leading-relaxed text-slate-200 text-base">
                                        {verdict.formal_judgment}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
                                    <button
                                        onClick={() => setShowDossierModal(false)}
                                        className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold transition-all"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* === FLOATING ACTION BUTTON - CASE DOSSIER === */}
            {gameStatus !== 'finished' && (
                <button
                    onClick={() => setShowDossierModal(true)}
                    className={`fixed bottom-24 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-2xl border-2 animate-pulse hover:animate-none hover:scale-105 active:scale-95 ${caseInfo.userRole === 'Defense'
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-cyan-500/30 hover:bg-cyan-500/30'
                        : 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-orange-500/30 hover:bg-orange-500/30'
                        }`}
                    style={{ animationDuration: '2s' }}
                >
                    <FolderOpen size={20} />
                    <span className="hidden sm:inline">CASE DOSSIER</span>
                </button>
            )}

            {/* === EVIDENCE MODAL === */}
            <EvidenceModal
                isOpen={showDossierModal}
                onClose={() => setShowDossierModal(false)}
                caseDetails={caseDetails}
                userRole={caseInfo.userRole}
            />

            {/* === END TRIAL CONFIRMATION MODAL === */}
            {showEndTrialModal && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[70] p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-white text-center mb-2">End Trial Early?</h2>
                        <p className="text-slate-400 text-center mb-8 text-sm leading-relaxed">
                            Are you sure you want to conclude the trial now? The Judge will deliver a final verdict based on the arguments presented so far.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setShowEndTrialModal(false)}
                                className="py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold transition-all"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleEndTrial}
                                className="py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow-lg shadow-red-500/20 transition-all"
                            >
                                END & VERDICT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === DAY TRANSITION OVERLAY === */}
            {showDayTransition && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[100] flex items-center justify-center animate-in fade-in duration-700">
                    <div className="text-center space-y-6 animate-in zoom-in-95 duration-1000">
                        <div className="w-24 h-24 rounded-3xl bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-cyan-500/20">
                            <Gavel size={48} className="text-cyan-400" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-5xl font-black text-white tracking-tighter">DAY {currentDay - 1} ADJOURNED</h2>
                            <p className="text-cyan-400 font-mono text-sm tracking-[0.3em] uppercase">Reconveying for Day {currentDay}...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// MESSAGE BUBBLE COMPONENT - Dynamic styling based on speakerRole
// ============================================================

const MessageBubble = ({ message, userRole }) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const [showLawPopover, setShowLawPopover] = useState(false);

    // System/Error Message
    if (isSystem) {
        return (
            <div className="flex justify-center">
                <div className="flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-950/40 text-red-400 border border-red-500/30">
                    <AlertTriangle size={14} />
                    {message.content}
                </div>
            </div>
        );
    }

    // USER Message (Right-aligned, Cyan neon)
    if (isUser) {
        return (
            <div className="flex justify-end gap-3 group">
                <div className="max-w-[85%] md:max-w-[75%] space-y-1">
                    <div className="flex items-center justify-end gap-2 pr-1">
                        <span className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-wider">My Argument</span>
                    </div>
                    <div className="px-6 py-4 rounded-3xl rounded-tr-lg bg-gradient-to-br from-cyan-600/90 to-blue-700/90 text-white shadow-2xl shadow-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0 mt-6">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-black border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/30">
                        YOU
                    </div>
                </div>
            </div>
        );
    }

    // AI Messages - Dynamic styling based on speakerRole
    const getSpeakerStyles = () => {
        // Map role to styling (matches backend ROLE_PROMPTS)
        const roleStyles = {
            // Judge - Gold/Amber theme
            'Judge': {
                container: 'bg-gradient-to-br from-amber-950/60 to-yellow-950/40 border-yellow-500/40 shadow-yellow-500/20',
                avatar: 'bg-gradient-to-br from-yellow-600 to-amber-700 border-yellow-400/50 shadow-yellow-500/40',
                avatarIcon: <Gavel size={20} className="text-yellow-200" />,
                nameColor: 'text-yellow-400',
                textColor: 'text-amber-100',
                badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
                glow: 'shadow-2xl shadow-yellow-500/20'
            },
            // Prosecutor - Red theme (Aggressive)
            'Prosecutor': {
                container: 'bg-gradient-to-br from-red-950/60 to-rose-950/40 border-red-600/40 shadow-red-500/20',
                avatar: 'bg-gradient-to-br from-red-600 to-rose-700 border-red-400/50 shadow-red-500/40',
                avatarIcon: <Sword size={20} className="text-red-200" />,
                nameColor: 'text-red-400',
                textColor: 'text-red-100',
                badge: 'bg-red-500/20 text-red-400 border-red-500/40',
                glow: 'shadow-2xl shadow-red-500/20'
            },
            // Opponent (alias for Prosecutor when user is Defense)
            'Opponent': {
                container: 'bg-gradient-to-br from-red-950/60 to-rose-950/40 border-red-600/40 shadow-red-500/20',
                avatar: 'bg-gradient-to-br from-red-600 to-rose-700 border-red-400/50 shadow-red-500/40',
                avatarIcon: <Sword size={20} className="text-red-200" />,
                nameColor: 'text-red-400',
                textColor: 'text-red-100',
                badge: 'bg-red-500/20 text-red-400 border-red-500/40',
                glow: 'shadow-2xl shadow-red-500/20'
            },
            // Defense Attorney - Cyan theme (Strategic)
            'DefenseAttorney': {
                container: 'bg-gradient-to-br from-cyan-950/60 to-teal-950/40 border-cyan-500/40 shadow-cyan-500/20',
                avatar: 'bg-gradient-to-br from-cyan-600 to-teal-700 border-cyan-400/50 shadow-cyan-500/40',
                avatarIcon: <Shield size={20} className="text-cyan-200" />,
                nameColor: 'text-cyan-400',
                textColor: 'text-cyan-100',
                badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
                glow: 'shadow-xl shadow-cyan-500/20'
            },
            // Witness - Blue theme (Emotional)
            'Witness': {
                container: 'bg-gradient-to-br from-blue-950/60 to-indigo-950/40 border-blue-500/30 shadow-blue-500/10',
                avatar: 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-400/50 shadow-blue-500/20',
                avatarIcon: <User size={20} className="text-blue-200" />,
                nameColor: 'text-blue-400',
                textColor: 'text-blue-100',
                badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                glow: 'shadow-xl shadow-blue-500/10'
            },
            // Clerk - Gray theme (Neutral/Procedural)
            'Clerk': {
                container: 'bg-gradient-to-br from-slate-900/60 to-gray-950/40 border-slate-500/30 shadow-slate-500/10',
                avatar: 'bg-gradient-to-br from-slate-500 to-gray-600 border-slate-400/50 shadow-slate-500/20',
                avatarIcon: <FileText size={20} className="text-slate-200" />,
                nameColor: 'text-slate-400',
                textColor: 'text-slate-200',
                badge: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
                glow: 'shadow-xl shadow-slate-500/10'
            }
        };

        // Return matching style or default (Purple for unknown)
        return roleStyles[message.speakerRole] || {
            container: 'bg-purple-950/40 border-purple-500/30 shadow-purple-500/10',
            avatar: 'bg-gradient-to-br from-purple-600 to-indigo-700 border-purple-400/50 shadow-purple-500/30',
            avatarIcon: <Scale size={20} className="text-purple-200" />,
            nameColor: 'text-purple-400',
            textColor: 'text-purple-100',
            badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            glow: 'shadow-xl shadow-purple-500/10'
        };
    };

    const styles = getSpeakerStyles();

    return (
        <div className="flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Avatar */}
            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${styles.avatar} ${styles.glow}`}>
                {styles.avatarIcon}
            </div>

            {/* Bubble Content */}
            <div className="max-w-[90%] md:max-w-[80%] space-y-2">
                {/* Speaker Name & Tags */}
                <div className="flex items-center flex-wrap gap-2 px-1">
                    <span className={`text-xs font-black uppercase tracking-wider ${styles.nameColor}`}>
                        {message.speaker}
                    </span>
                    {message.action && (
                        <span className={`text-[9px] px-2 py-0.5 rounded-md border font-black uppercase tracking-tight ${styles.badge}`}>
                            {message.action}
                        </span>
                    )}

                    {/* Legal Citation Badge */}
                    {message.relevantLaws && (
                        <div className="relative">
                            <button
                                onMouseEnter={() => setShowLawPopover(true)}
                                onMouseLeave={() => setShowLawPopover(false)}
                                onClick={() => setShowLawPopover(!showLawPopover)}
                                className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:scale-105 active:scale-95 transition-all animate-pulse shadow-lg shadow-purple-500/30"
                            >
                                📜 LEGAL CITATION
                            </button>

                            {/* Citation Tooltip */}
                            {showLawPopover && (
                                <div className="absolute bottom-full left-0 mb-3 w-80 max-h-60 overflow-y-auto p-5 z-50 rounded-2xl border backdrop-blur-2xl bg-slate-900/95 border-purple-500/40 text-slate-300 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-500/20">
                                        <FileText size={14} className="text-purple-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">Reference Text</span>
                                    </div>
                                    <div className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap opacity-90">
                                        {message.relevantLaws}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-purple-500/20 flex justify-between items-center opacity-50">
                                        <span className="text-[8px] font-black uppercase tracking-tighter">Source: Lawnova Database</span>
                                        <BookOpen size={10} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Message Bubble */}
                <div className={`px-6 py-4 rounded-3xl rounded-tl-lg border backdrop-blur-xl ${styles.container} ${styles.glow}`}>
                    <p className={`text-sm leading-relaxed ${styles.textColor}`}>
                        {message.content}
                    </p>
                </div>

                {/* Mood Indicator */}
                {message.mood && (
                    <div className="flex items-center gap-1.5 px-2">
                        <div className="w-1 h-1 rounded-full bg-slate-600" />
                        <p className="text-[10px] font-bold text-slate-600">
                            MOOD: <span className={`italic tracking-wide ${styles.nameColor}`}>{message.mood.toUpperCase()}</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameInterface;
