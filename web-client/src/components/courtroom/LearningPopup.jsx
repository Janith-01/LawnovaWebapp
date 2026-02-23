import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle,
    BookOpen, Brain, Award, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============================================
// MOCK LEARNING DATA (Until RAG is connected)
// ============================================

const mockLearningData = {
    flashcards: [
        {
            front: "Section 32 - Evidence Act",
            back: "Dying Declarations - Statements made by a person as to the cause of his death or any of the circumstances of the transaction which resulted in his death, in cases in which the cause of that person's death comes into question."
        },
        {
            front: "Section 114 - Evidence Act",
            back: "Court May Presume Existence of Certain Facts - The Court may presume the existence of any fact which it thinks likely to have happened, regard being had to the common course of natural events and human conduct."
        },
        {
            front: "Right to Silence",
            back: "An accused person has the constitutional right to remain silent and cannot be compelled to testify against themselves. This principle is enshrined in Article 13(3) of the Constitution of Sri Lanka."
        },
        {
            front: "Burden of Proof",
            back: "In criminal cases, the burden of proof lies with the prosecution. They must prove the guilt of the accused beyond reasonable doubt. The accused is presumed innocent until proven guilty."
        },
        {
            front: "Section 109 - Evidence Act",
            back: "Burden of Proof - Whoever desires any Court to give judgment as to any legal right or liability dependent on the existence of facts which he asserts, must prove that those facts exist."
        }
    ],
    quizzes: [
        {
            question: "What is the standard of proof required in criminal trials in Sri Lanka?",
            options: [
                "Balance of probabilities",
                "Beyond reasonable doubt",
                "Clear and convincing evidence",
                "Preponderance of evidence"
            ],
            correctAnswer: 1,
            explanation: "In criminal cases, the prosecution must prove guilt beyond reasonable doubt, which is a higher standard than civil cases."
        },
        {
            question: "Under which section of the Evidence Act are dying declarations admissible?",
            options: [
                "Section 30",
                "Section 32",
                "Section 114",
                "Section 109"
            ],
            correctAnswer: 1,
            explanation: "Section 32 of the Evidence Act deals with dying declarations and statements made by persons who cannot be called as witnesses."
        },
        {
            question: "Who bears the burden of proof in a criminal trial?",
            options: [
                "The accused",
                "The victim",
                "The prosecution",
                "The judge"
            ],
            correctAnswer: 2,
            explanation: "The prosecution bears the burden of proving the guilt of the accused beyond reasonable doubt."
        },
        {
            question: "What right does Article 13(3) of the Constitution guarantee?",
            options: [
                "Right to a fair trial",
                "Right to legal representation",
                "Right to remain silent",
                "Right to bail"
            ],
            correctAnswer: 2,
            explanation: "Article 13(3) guarantees the right to silence - an accused cannot be compelled to testify against themselves."
        },
        {
            question: "What can the Court presume under Section 114 of the Evidence Act?",
            options: [
                "Only facts proven by documentation",
                "Facts likely to have happened based on common course of events",
                "Only facts testified by witnesses",
                "Facts admitted by the accused"
            ],
            correctAnswer: 1,
            explanation: "Section 114 allows courts to presume facts that are likely to have happened based on the common course of natural events and human conduct."
        }
    ]
};

/**
 * AI-Generated Learning Popup Component
 * Dark Theme Overlay with Flashcards and Quiz
 */
const LearningPopup = ({ roomId, onClose }) => {
    const { token, user } = useAuth();
    const userId = user?.id || user?._id;

    const [showPopup, setShowPopup] = useState(false);
    const [learningData, setLearningData] = useState(null);
    const [activeTab, setActiveTab] = useState('flashcards');

    // Internal tracking for room details (captured from socket event)
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

    // TRIGGER & STATE: Listen for TRIAL_COMPLETED socket event
    useEffect(() => {
        // We need either a specific roomId OR a logged-in user to listen
        if (!roomId && !userId) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log(`[LearningPopup] Socket connected ${socket.id}`);

            // Join specific room if provided
            if (roomId) {
                socket.emit('join:room', { roomId });
            }

            // Join global user channel to receive completion events anywhere
            if (userId) {
                socket.emit('join:user', { userId });
            }
        });

        // Listen for TRIAL_COMPLETED event
        socket.on('TRIAL_COMPLETED', (data) => {
            // Only show if it matches our roomId OR if we are in global mode
            if (!roomId || data?.trialId === roomId || data?.roomId === roomId) {
                console.log('[LearningPopup] Trial completed event received', data);

                const rid = data?.trialId || data?.roomId || roomId;
                setActiveRoomId(rid);
                if (data?.topic) setActiveTopic(data.topic);

                // Use data-provided materials if available, otherwise fallback to mock
                setLearningData(data.studyMaterials || mockLearningData);
                setShowPopup(true);
            }
        });

        // Also listen for SHOW_LEARNING_POPUP (backward compatibility)
        socket.on('SHOW_LEARNING_POPUP', (data) => {
            if (!roomId || data?.roomId === roomId) {
                console.log('[LearningPopup] Showing learning materials via SHOW_LEARNING_POPUP');

                const rid = data?.roomId || roomId;
                setActiveRoomId(rid);
                if (data?.trialTopic) setActiveTopic(data.trialTopic);

                setLearningData(data.learningMaterials || mockLearningData);
                setShowPopup(true);
            }
        });

        return () => {
            if (roomId) socket.emit('leave:room', { roomId });
            socket.disconnect();
        };
    }, [roomId, userId, token]);

    // Flashcard Navigation
    const flashcards = learningData?.flashcards || [];
    const currentCard = flashcards[currentCardIndex];

    const nextCard = () => {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentCardIndex((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
        }, 300);
    };

    const prevCard = () => {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentCardIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
        }, 300);
    };

    // Quiz Logic
    const quizzes = learningData?.quizzes || [];
    const currentQuestion = quizzes[currentQuestionIndex];

    const handleAnswerSelect = (answerIndex) => {
        if (showResult) return;
        setSelectedAnswer(answerIndex);
    };

    const submitAnswer = () => {
        if (selectedAnswer === null) return;

        setUserAnswers(prev => [...prev, {
            questionIndex: currentQuestionIndex,
            userAnswer: selectedAnswer,
            correct: selectedAnswer === currentQuestion?.correctAnswer
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
            syncMasteryTracker();
        }
    };

    const resetQuiz = () => {
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setSelectedAnswer(null);
        setShowResult(false);
        setQuizCompleted(false);
    };

    const correctAnswers = userAnswers.filter(a => a?.correct)?.length || 0;
    const score = quizzes.length > 0 ? Math.round((correctAnswers / quizzes.length) * 100) : 0;

    // MASTERY SYNC: Send quiz results to User-Service
    const syncMasteryTracker = async () => {
        const syncRoomId = activeRoomId || roomId;
        if (!syncRoomId || !token) return;

        try {
            const masteryData = {
                roomId: syncRoomId,
                topic: activeTopic || 'Mock Trial',
                quizScore: score,
                totalQuestions: quizzes.length,
                correctAnswers,
                completedAt: new Date(),
                answers: userAnswers
            };

            await axios.post(`${SOCKET_URL}/api/users/mastery-tracker`, masteryData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('[LearningPopup] Mastery data synced successfully');
        } catch (error) {
            console.error('[LearningPopup] Failed to sync mastery tracker:', error);
        }
    };

    const handleFinishReview = () => {
        setShowPopup(false);
        onClose?.();
    };

    if (!showPopup) return null;

    return (
        <AnimatePresence>
            {/* Blurred Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 font-['Inter']"
                onClick={handleFinishReview}
            >
                {/* Main Container */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-7xl h-[90vh] bg-[#1E293B] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#9333EA] flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Learning Review</h1>
                                <p className="text-sm text-slate-400">Master key concepts from your trial</p>
                            </div>
                        </div>
                        <button
                            onClick={handleFinishReview}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="px-6 py-4 border-b border-slate-700 flex gap-3">
                        <button
                            onClick={() => setActiveTab('flashcards')}
                            className={cn(
                                "px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all",
                                activeTab === 'flashcards'
                                    ? "bg-[#9333EA] text-white"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            )}
                        >
                            <BookOpen className="w-4 h-4" />
                            Flashcards ({flashcards.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('quiz')}
                            className={cn(
                                "px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all",
                                activeTab === 'quiz'
                                    ? "bg-[#9333EA] text-white"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            )}
                        >
                            <Brain className="w-4 h-4" />
                            Quiz ({quizzes.length} Questions)
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden p-6">
                        {activeTab === 'flashcards' ? (
                            <FlashcardPanel
                                currentCard={currentCard}
                                currentIndex={currentCardIndex}
                                total={flashcards.length}
                                isFlipped={isFlipped}
                                onFlip={() => setIsFlipped(!isFlipped)}
                                onPrev={prevCard}
                                onNext={nextCard}
                            />
                        ) : (
                            <QuizPanel
                                currentQuestion={currentQuestion}
                                currentIndex={currentQuestionIndex}
                                total={quizzes.length}
                                selectedAnswer={selectedAnswer}
                                showResult={showResult}
                                quizCompleted={quizCompleted}
                                score={score}
                                correctAnswers={correctAnswers}
                                onSelectAnswer={handleAnswerSelect}
                                onSubmit={submitAnswer}
                                onNext={nextQuestion}
                                onReset={resetQuiz}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-700 flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            {activeTab === 'flashcards'
                                ? `Card ${currentCardIndex + 1} of ${flashcards.length}`
                                : quizCompleted
                                    ? `Quiz Complete: ${score}%`
                                    : `Question ${currentQuestionIndex + 1} of ${quizzes.length}`
                            }
                        </div>
                        <button
                            onClick={handleFinishReview}
                            className="px-6 py-2.5 rounded-lg bg-[#9333EA] hover:bg-[#7e22ce] text-white font-semibold transition-all flex items-center gap-2"
                        >
                            Finish Review
                            <CheckCircle className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ============================================
// FLASHCARD PANEL (3D Flip Card)
// ============================================

const FlashcardPanel = ({ currentCard, currentIndex, total, isFlipped, onFlip, onPrev, onNext }) => {
    if (!currentCard) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400">
                No flashcards available
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center gap-8">
            {/* 3D Flip Card */}
            <div
                className="relative w-full max-w-2xl h-80 cursor-pointer perspective-1000"
                onClick={onFlip}
            >
                <motion.div
                    className="relative w-full h-full"
                    style={{
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.6s',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                >
                    {/* Front of Card */}
                    <div
                        className="absolute inset-0 flex items-center justify-center p-8 bg-[#1E293B] border-2 border-slate-700 rounded-2xl shadow-xl"
                        style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden'
                        }}
                    >
                        <div className="text-center">
                            <p className="text-xs font-semibold text-[#9333EA] uppercase tracking-wider mb-4">
                                Front
                            </p>
                            <h2 className="text-2xl font-bold text-[#FFFFFF] leading-relaxed">
                                {currentCard.front}
                            </h2>
                            <p className="text-sm text-slate-400 mt-6">
                                Click to reveal answer
                            </p>
                        </div>
                    </div>

                    {/* Back of Card */}
                    <div
                        className="absolute inset-0 flex items-center justify-center p-8 bg-[#1E293B] border-2 border-[#9333EA] rounded-2xl shadow-xl"
                        style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)'
                        }}
                    >
                        <div className="text-center">
                            <p className="text-xs font-semibold text-[#9333EA] uppercase tracking-wider mb-4">
                                Back
                            </p>
                            <p className="text-lg text-[#FFFFFF] leading-relaxed">
                                {currentCard.back}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-4">
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    disabled={total <= 1}
                    className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-sm text-slate-400 font-medium">
                    {currentIndex + 1} / {total}
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    disabled={total <= 1}
                    className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

// ============================================
// QUIZ PANEL (Step-by-Step Interface)
// ============================================

const QuizPanel = ({
    currentQuestion,
    currentIndex,
    total,
    selectedAnswer,
    showResult,
    quizCompleted,
    score,
    correctAnswers,
    onSelectAnswer,
    onSubmit,
    onNext,
    onReset
}) => {
    if (quizCompleted) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-full bg-[#9333EA] flex items-center justify-center">
                    <Award className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Quiz Completed!</h2>
                <p className="text-lg text-slate-300">
                    You scored <span className="font-bold text-[#9333EA]">{correctAnswers}</span> out of {total}
                </p>
                <div className="text-5xl font-bold text-white">{score}%</div>
                <button
                    onClick={onReset}
                    className="mt-4 px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-2 transition-all"
                >
                    <RotateCcw className="w-4 h-4" />
                    Retry Quiz
                </button>
            </div>
        );
    }

    if (!currentQuestion) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400">
                No quiz questions available
            </div>
        );
    }

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    return (
        <div className="h-full flex flex-col justify-center max-w-3xl mx-auto gap-6">
            {/* Question */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <p className="text-sm font-semibold text-[#9333EA] uppercase tracking-wider mb-3">
                    Question {currentIndex + 1}
                </p>
                <h3 className="text-xl font-bold text-white leading-relaxed">
                    {currentQuestion.question}
                </h3>
            </div>

            {/* Options */}
            <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isThisCorrect = idx === currentQuestion.correctAnswer;

                    let optionClass = "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white";

                    if (showResult) {
                        if (isThisCorrect) {
                            optionClass = "bg-green-500/20 border-green-500 text-green-300";
                        } else if (isSelected && !isThisCorrect) {
                            optionClass = "bg-red-500/20 border-red-500 text-red-300";
                        }
                    } else if (isSelected) {
                        optionClass = "bg-[#9333EA] border-[#9333EA] text-white";
                    }

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectAnswer(idx)}
                            disabled={showResult}
                            className={cn(
                                "w-full p-4 rounded-lg border-2 text-left font-medium transition-all disabled:cursor-not-allowed flex items-center gap-3",
                                optionClass
                            )}
                        >
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-900/50 flex items-center justify-center font-bold">
                                {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="flex-1">{option}</span>
                            {showResult && isThisCorrect && <CheckCircle className="w-5 h-5 text-green-400" />}
                            {showResult && isSelected && !isThisCorrect && <XCircle className="w-5 h-5 text-red-400" />}
                        </button>
                    );
                })}
            </div>

            {/* Explanation (shown after answer) */}
            {showResult && currentQuestion.explanation && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "p-4 rounded-lg border-2",
                        isCorrect
                            ? "bg-green-500/20 border-green-500/50 text-green-200"
                            : "bg-yellow-500/20 border-yellow-500/50 text-yellow-200"
                    )}
                >
                    <p className="font-semibold mb-2">
                        {isCorrect ? "Correct!" : "Incorrect"}
                    </p>
                    <p className="text-sm">{currentQuestion.explanation}</p>
                </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
                {!showResult ? (
                    <button
                        onClick={onSubmit}
                        disabled={selectedAnswer === null}
                        className="px-6 py-3 rounded-lg bg-[#9333EA] hover:bg-[#7e22ce] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Submit Answer
                    </button>
                ) : (
                    <button
                        onClick={onNext}
                        className="px-6 py-3 rounded-lg bg-[#9333EA] hover:bg-[#7e22ce] text-white font-semibold transition-all flex items-center gap-2"
                    >
                        {currentIndex < total - 1 ? 'Next Question' : 'Finish Quiz'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default LearningPopup;
