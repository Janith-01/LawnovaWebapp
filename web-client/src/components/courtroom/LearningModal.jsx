import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppMessage } from '@daily-co/daily-react';
import {
    X, ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle,
    BookOpen, Brain, Award, Sparkles, Landmark, Scale
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const LearningModal = ({ roomId, isOpen, onClose }) => {
    const { token, user } = useAuth();
    const userId = user?.id || user?._id;

    const [showPopup, setShowPopup] = useState(false);
    const [learningData, setLearningData] = useState(null);
    const [activeTab, setActiveTab] = useState('flashcards');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [startTime, setStartTime] = useState(null);

    // Initial state setup for topic and roomId
    const [activeRoomId, setActiveRoomId] = useState(roomId);
    const [activeTopic, setActiveTopic] = useState('Mock Trial');

    // Flashcard state
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    // Quiz state
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [quizCompleted, setQuizCompleted] = useState(false);

    // DAILY.CO APP MESSAGE LISTENERS
    // Automatically listener for the AI results to trigger the popup
    const handleAppMessage = useCallback((event) => {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (msg.type === 'LOADING_LEARNING') {
            setIsLoading(true);
            setLoadingMessage(msg.data?.message || 'AI is analyzing transcript...');
            setStartTime(performance.now()); // Start latency timer
        }

        if (msg.type === 'STUDY_MATERIAL_AVAILABLE') {
            const endTime = performance.now();
            const latency = startTime ? ((endTime - startTime) / 1000).toFixed(2) : "Unknown";
            console.log(`[AI-Realtime-Performance] Button Click to Modal Open: ${latency}s`);

            setIsLoading(false);
            setLearningData(msg.payload || msg.data?.learningMaterials);
            setShowPopup(true);
        }
    }, [startTime]);

    useAppMessage({ onAppMessage: handleAppMessage });

    // Local override for the sender (Judge) since sendAppMessage doesn't loop back
    useEffect(() => {
        const handleLocalReady = (e) => {
            setIsLoading(false);
            setLearningData(e.detail);
            setShowPopup(true);
        };
        window.addEventListener('LOCAL_STUDY_MATERIAL_READY', handleLocalReady);
        return () => window.removeEventListener('LOCAL_STUDY_MATERIAL_READY', handleLocalReady);
    }, []);

    // Listen for socket events if the user is in dashboard or somewhere else
    useEffect(() => {
        if (!userId) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            if (roomId) socket.emit('join:room', { roomId });
            if (userId) socket.emit('join:user', { userId });
        });

        socket.on('STUDY_MATERIAL_READY', (data) => {
            console.log('[LearningModal] Study materials ready via Socket');
            setLearningData(data.studyMaterials);
            setShowPopup(true);
        });

        return () => {
            if (roomId) socket.emit('leave:room', { roomId });
            socket.disconnect();
        };
    }, [roomId, userId, token]);

    // Flashcard Nav
    const flashcards = learningData?.flashcards || [];
    const currentCard = flashcards[currentCardIndex];

    const nextCard = () => {
        setIsFlipped(false);
        setTimeout(() => setCurrentCardIndex(prev => (prev < flashcards.length - 1 ? prev + 1 : 0)), 150);
    };

    const prevCard = () => {
        setIsFlipped(false);
        setTimeout(() => setCurrentCardIndex(prev => (prev > 0 ? prev - 1 : flashcards.length - 1)), 150);
    };

    // Quiz Logic
    const quizzes = learningData?.quizzes || [];
    const currentQuestion = quizzes[currentQuestionIndex];

    const handleAnswerSelect = (idx) => {
        if (showResult) return;
        setSelectedAnswer(idx);
    };

    const submitAnswer = () => {
        if (selectedAnswer === null) return;
        setUserAnswers(prev => [...prev, {
            questionIndex: currentQuestionIndex,
            userAnswer: selectedAnswer,
            correct: selectedAnswer === (currentQuestion?.correctAnswer || currentQuestion?.answer)
        }]);
        setShowResult(true);
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < quizzes.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        } else {
            setQuizCompleted(true);
        }
    };

    const resetQuiz = () => {
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setSelectedAnswer(null);
        setShowResult(false);
        setQuizCompleted(false);
    };

    const correctCount = userAnswers.filter(a => a.correct).length;
    const scoreVal = quizzes.length > 0 ? Math.round((correctCount / quizzes.length) * 100) : 0;

    const handleClose = () => {
        setShowPopup(false);
        if (onClose) onClose();
    };

    if (!showPopup && !isLoading) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8"
            >
                {/* Background Glass Overlay */}
                <div
                    className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                    onClick={handleClose}
                />

                {isLoading ? (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative z-10 flex flex-col items-center gap-6 p-12 bg-gray-900/80 rounded-3xl border border-white/10 backdrop-blur-2xl shadow-2xl text-center"
                    >
                        <div className="relative">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border-t-4 border-purple-500"
                            />
                            <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-purple-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{loadingMessage}</h2>
                        <p className="text-gray-400 max-w-sm italic">
                            The Legal AI Agent is cross-referencing trial arguments with official Sri Lankan Statutes and Case Law...
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        className="relative z-10 w-full max-w-6xl h-[85vh] bg-[#1E293B]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Glass Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">AI Smart Suite</h1>
                                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Dynamic Learning from trial proceedings</p>
                                </div>
                            </div>
                            <button onClick={handleClose} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="px-8 py-4 bg-white/5 flex gap-4">
                            {[
                                { id: 'flashcards', label: `Flashcards (${flashcards.length})`, icon: BookOpen },
                                { id: 'quiz', label: `Quiz Portal (${quizzes.length})`, icon: Brain }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all",
                                        activeTab === tab.id
                                            ? "bg-white text-gray-950 shadow-xl"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {activeTab === 'flashcards' ? (
                                <FlashcardView
                                    card={currentCard}
                                    isFlipped={isFlipped}
                                    onFlip={() => setIsFlipped(!isFlipped)}
                                    onNext={nextCard}
                                    onPrev={prevCard}
                                    index={currentCardIndex}
                                    total={flashcards.length}
                                />
                            ) : (
                                <QuizView
                                    question={currentQuestion}
                                    index={currentQuestionIndex}
                                    total={quizzes.length}
                                    selectedAnswer={selectedAnswer}
                                    showResult={showResult}
                                    quizCompleted={quizCompleted}
                                    score={scoreVal}
                                    correctCount={correctCount}
                                    onSelect={handleAnswerSelect}
                                    onSubmit={submitAnswer}
                                    onNext={nextQuestion}
                                    onReset={resetQuiz}
                                />
                            )}
                        </div>

                        {/* Glass Footer */}
                        <div className="p-8 border-t border-white/5 flex items-center justify-between text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>AI Engine Linked</span>
                                </div>
                                <div className="mx-2">•</div>
                                <span>Sri Lankan Legal Corpus Grounded</span>
                            </div>
                            <div className="text-gray-400">
                                {activeTopic} • Session Review
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

/* --- Sub-Components --- */

const FlashcardView = ({ card, isFlipped, onFlip, onNext, onPrev, index, total }) => {
    if (!card) return null;

    return (
        <div className="h-full flex flex-col items-center justify-center gap-12">
            <div
                className="relative w-full max-w-2xl h-[400px] cursor-pointer"
                style={{ perspective: '2000px' }}
                onClick={onFlip}
            >
                <motion.div
                    className="w-full h-full relative"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* Front Side */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-[3rem] shadow-xl"
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        <Landmark className="w-12 h-12 text-purple-400 mb-8 opacity-40" />
                        <h2 className="text-3xl font-black text-white text-center leading-tight">
                            {card.front}
                        </h2>
                        <p className="mt-12 text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
                            Click to Reveal Legal Breakdown
                        </p>
                    </div>

                    {/* Back Side */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-[3rem] shadow-xl"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        <Award className="w-10 h-10 text-purple-400 mb-6" />
                        <p className="text-xl text-white text-center leading-relaxed">
                            {card.back}
                        </p>

                        {card.citation && (
                            <div className="mt-10 p-5 rounded-2xl bg-white/5 border border-white/10 w-full">
                                <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest block mb-2">Legal Citation & Grounding</span>
                                <p className="text-sm italic text-gray-300">Section {card.citation}</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            <div className="flex items-center gap-8">
                <button onClick={onPrev} className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all">
                    <ChevronLeft />
                </button>
                <div className="font-mono text-white text-lg">
                    <span className="text-purple-400">{index + 1}</span> / {total}
                </div>
                <button onClick={onNext} className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all">
                    <ChevronRight />
                </button>
            </div>
        </div>
    );
};

const QuizView = ({ question, index, total, selectedAnswer, showResult, quizCompleted, score, correctCount, onSelect, onSubmit, onNext, onReset }) => {
    if (quizCompleted) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-8 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/20"
                >
                    <Award className="w-16 h-16 text-white" />
                </motion.div>
                <div>
                    <h2 className="text-5xl font-black text-white mb-2">Mastery Achieved</h2>
                    <p className="text-gray-400 text-lg uppercase tracking-widest font-bold">{correctCount} of {total} Correct</p>
                </div>
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">{score}%</div>
                <button onClick={onReset} className="px-10 py-4 bg-white text-gray-950 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-transform mt-8">
                    Retake Examination
                </button>
            </div>
        );
    }

    if (!question) return null;

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-10">
            <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10">
                <span className="text-purple-400 text-xs font-black uppercase tracking-[0.3em] block mb-4">Question {index + 1} of {total}</span>
                <h3 className="text-2xl font-bold text-white leading-tight">
                    {question.question}
                </h3>
            </div>

            <div className="grid gap-4">
                {question.options.map((opt, i) => {
                    const isCorrect = i === (question.correctAnswer || question.answer);
                    const isSelected = selectedAnswer === i;

                    let stateClass = "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10";
                    if (showResult) {
                        if (isCorrect) stateClass = "bg-green-500/20 border-green-500/50 text-green-300 shadow-lg shadow-green-500/10";
                        else if (isSelected) stateClass = "bg-red-500/20 border-red-500/50 text-red-300";
                    } else if (isSelected) {
                        stateClass = "bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/20";
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => onSelect(i)}
                            disabled={showResult}
                            className={cn(
                                "p-6 rounded-3xl border-2 text-left font-bold transition-all flex items-center gap-5 group",
                                stateClass
                            )}
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                                isSelected ? "bg-white/20" : "bg-black/20"
                            )}>
                                {String.fromCharCode(65 + i)}
                            </div>
                            <span className="flex-1">{opt}</span>
                            {showResult && isCorrect && <CheckCircle className="w-6 h-6 text-green-400" />}
                        </button>
                    );
                })}
            </div>

            {showResult && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-3xl bg-indigo-500/10 border border-indigo-500/30"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <Scale className="w-5 h-5 text-indigo-400" />
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Legal Explanation</span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        {question.explanation}
                    </p>
                </motion.div>
            )}

            <div className="flex justify-end pt-4">
                {!showResult ? (
                    <button
                        onClick={onSubmit}
                        disabled={selectedAnswer === null}
                        className="px-12 py-5 bg-[#9333EA] text-white rounded-2xl font-black uppercase tracking-widest disabled:opacity-30 hover:scale-105 transition-transform"
                    >
                        Submit Answer
                    </button>
                ) : (
                    <button
                        onClick={onNext}
                        className="px-12 py-5 bg-white text-gray-950 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
                    >
                        {index < total - 1 ? 'Next Challenge' : 'Finish Quiz'}
                        <ChevronRight className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default LearningModal;
