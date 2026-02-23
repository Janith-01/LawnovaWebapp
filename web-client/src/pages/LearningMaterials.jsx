import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    CheckCircle,
    XCircle,
    ArrowLeft,
    ArrowRight,
    RotateCw,
    Award,
    Target,
    Sparkles,
    BookOpen,
    Zap,
    Trophy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * LearningMaterials - Flashcards & Quizzes Page
 * Accessible to all users for legal concept mastery
 */
const LearningMaterials = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('home'); // 'home', 'flashcards', 'quiz'
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [quizProgress, setQuizProgress] = useState({
        currentQuestion: 0,
        score: 0,
        answers: []
    });

    // Mock Flashcard Data
    const flashcards = [
        {
            id: 1,
            category: 'Criminal Law',
            question: 'What is Section 300 of the Penal Code?',
            answer: 'Section 300 defines murder: Whoever causes death by doing an act with the intention of causing death, or with knowledge that death is likely to result, commits murder.',
            difficulty: 'Advanced'
        },
        {
            id: 2,
            category: 'Evidence Law',
            question: 'What is hearsay evidence?',
            answer: 'Hearsay is an out-of-court statement offered to prove the truth of the matter asserted. Generally inadmissible under Section 60 of the Evidence Ordinance.',
            difficulty: 'Intermediate'
        },
        {
            id: 3,
            category: 'Constitutional Law',
            question: 'What does Article 126 protect?',
            answer: 'Article 126 of the Constitution protects fundamental rights. It empowers the Supreme Court to grant relief for violations of fundamental rights.',
            difficulty: 'Basic'
        },
        {
            id: 4,
            category: 'Criminal Procedure',
            question: 'What is a prima facie case?',
            answer: 'A prima facie case exists when there is sufficient evidence to establish a fact unless rebutted. It shifts the burden of proof to the defense.',
            difficulty: 'Intermediate'
        },
        {
            id: 5,
            category: 'Contract Law',
            question: 'What are the essential elements of a valid contract?',
            answer: '1) Offer and Acceptance, 2) Consideration, 3) Intention to create legal relations, 4) Capacity to contract, 5) Free consent.',
            difficulty: 'Basic'
        }
    ];

    // Mock Quiz Data
    const quizQuestions = [
        {
            id: 1,
            question: 'Under which section of the Penal Code is theft defined?',
            options: ['Section 362', 'Section 366', 'Section 300', 'Section 120'],
            correct: 1,
            explanation: 'Section 366 defines theft as dishonest misappropriation of property.',
            category: 'Criminal Law'
        },
        {
            id: 2,
            question: 'What is the burden of proof in criminal cases?',
            options: [
                'Balance of probabilities',
                'Beyond reasonable doubt',
                'Clear and convincing evidence',
                'Preponderance of evidence'
            ],
            correct: 1,
            explanation: 'In criminal cases, the prosecution must prove guilt "beyond reasonable doubt".',
            category: 'Evidence Law'
        },
        {
            id: 3,
            question: 'Which article grants the right to equality before the law?',
            options: ['Article 10', 'Article 12', 'Article 126', 'Article 13'],
            correct: 1,
            explanation: 'Article 12 of the Constitution guarantees equality before the law and equal protection.',
            category: 'Constitutional Law'
        },
        {
            id: 4,
            question: 'What is mens rea?',
            options: [
                'Guilty mind/criminal intent',
                'Physical act of crime',
                'Result of the crime',
                'Motive for crime'
            ],
            correct: 0,
            explanation: 'Mens rea refers to the guilty mind or criminal intent required for most offenses.',
            category: 'Criminal Law'
        },
        {
            id: 5,
            question: 'What does the principle of "stare decisis" mean?',
            options: [
                'Stand by things decided',
                'Innocent until proven guilty',
                'Let justice be done',
                'Hear the other side'
            ],
            correct: 0,
            explanation: 'Stare decisis means "to stand by things decided" - courts follow precedent.',
            category: 'Legal Principles'
        }
    ];

    // Flashcard Handlers
    const handleFlip = () => setIsFlipped(!isFlipped);

    const handleNextCard = () => {
        setIsFlipped(false);
        setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
    };

    const handlePrevCard = () => {
        setIsFlipped(false);
        setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    };

    // Quiz Handlers
    const handleQuizAnswer = (selectedIndex) => {
        const currentQ = quizQuestions[quizProgress.currentQuestion];
        const isCorrect = selectedIndex === currentQ.correct;

        const newAnswers = [...quizProgress.answers, {
            questionId: currentQ.id,
            selected: selectedIndex,
            correct: currentQ.correct,
            isCorrect
        }];

        if (isCorrect) {
            toast.success('Correct! Well done! 🎉');
        } else {
            toast.error('Incorrect. Review the explanation.');
        }

        setQuizProgress({
            ...quizProgress,
            answers: newAnswers,
            score: quizProgress.score + (isCorrect ? 1 : 0),
            currentQuestion: quizProgress.currentQuestion + 1
        });
    };

    const resetQuiz = () => {
        setQuizProgress({
            currentQuestion: 0,
            score: 0,
            answers: []
        });
    };

    // Get current content based on mode
    const currentCard = flashcards[currentCardIndex];
    const currentQuestion = quizQuestions[quizProgress.currentQuestion];
    const quizComplete = quizProgress.currentQuestion >= quizQuestions.length;
    const quizPercentage = quizComplete ? Math.round((quizProgress.score / quizQuestions.length) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => mode === 'home' ? navigate(-1) : setMode('home')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
                    >
                        <ArrowLeft size={20} />
                        {mode === 'home' ? 'Back to Dashboard' : 'Back to Home'}
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-2xl shadow-amber-500/50">
                            <Brain className="w-8 h-8 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black mb-2">Learning Materials</h1>
                            <p className="text-slate-400">Master legal concepts with interactive flashcards and quizzes</p>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'home' && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            {/* Flashcards Card */}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-3xl p-8 border border-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer shadow-2xl"
                                onClick={() => setMode('flashcards')}
                            >
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/50">
                                    <RotateCw className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-3xl font-black mb-3">Flashcards</h2>
                                <p className="text-slate-300 mb-6">
                                    Review {flashcards.length} legal concepts with interactive flashcards. Perfect for quick revision and memorization.
                                </p>
                                <div className="flex items-center gap-2 text-purple-400 font-semibold">
                                    <Sparkles size={20} />
                                    <span>Start Learning</span>
                                    <ArrowRight size={20} className="ml-auto" />
                                </div>
                            </motion.div>

                            {/* Quizzes Card */}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="bg-gradient-to-br from-amber-900/30 to-yellow-900/30 rounded-3xl p-8 border border-amber-500/30 hover:border-amber-400/50 transition-all cursor-pointer shadow-2xl"
                                onClick={() => setMode('quiz')}
                            >
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/50">
                                    <Trophy className="w-8 h-8 text-slate-900" />
                                </div>
                                <h2 className="text-3xl font-black mb-3">Practice Quiz</h2>
                                <p className="text-slate-300 mb-6">
                                    Test your knowledge with {quizQuestions.length} challenging questions. Track your progress and identify weak areas.
                                </p>
                                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                                    <Zap size={20} />
                                    <span>Take Quiz</span>
                                    <ArrowRight size={20} className="ml-auto" />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {mode === 'flashcards' && (
                        <motion.div
                            key="flashcards"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="max-w-3xl mx-auto"
                        >
                            {/* Progress */}
                            <div className="mb-6 text-center">
                                <p className="text-slate-400">
                                    Card {currentCardIndex + 1} of {flashcards.length}
                                </p>
                                <div className="w-full h-2 bg-slate-800 rounded-full mt-2">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
                                        style={{ width: `${((currentCardIndex + 1) / flashcards.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Flashcard */}
                            <div
                                className="relative h-96 cursor-pointer mb-8"
                                onClick={handleFlip}
                            >
                                <motion.div
                                    className="absolute inset-0 w-full h-full"
                                    initial={false}
                                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                                    transition={{ duration: 0.6 }}
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    {/* Front */}
                                    <div
                                        className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 border-2 border-purple-500/50 shadow-2xl flex flex-col justify-between"
                                        style={{ backfaceVisibility: 'hidden' }}
                                    >
                                        <div>
                                            <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-semibold mb-4 border border-purple-500/30">
                                                {currentCard.category}
                                            </span>
                                            <h2 className="text-2xl font-bold text-white leading-relaxed">
                                                {currentCard.question}
                                            </h2>
                                        </div>
                                        <p className="text-slate-400 text-sm flex items-center gap-2">
                                            <RotateCw size={16} />
                                            Click to reveal answer
                                        </p>
                                    </div>

                                    {/* Back */}
                                    <div
                                        className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 border-2 border-indigo-500/50 shadow-2xl flex flex-col justify-between"
                                        style={{
                                            backfaceVisibility: 'hidden',
                                            transform: 'rotateY(180deg)'
                                        }}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-semibold border border-indigo-500/30">
                                                    Answer
                                                </span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentCard.difficulty === 'Basic' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                        currentCard.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                            'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    }`}>
                                                    {currentCard.difficulty}
                                                </span>
                                            </div>
                                            <p className="text-lg text-white leading-relaxed">
                                                {currentCard.answer}
                                            </p>
                                        </div>
                                        <p className="text-indigo-300 text-sm flex items-center gap-2">
                                            <CheckCircle size={16} />
                                            Click to flip back
                                        </p>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between items-center">
                                <button
                                    onClick={handlePrevCard}
                                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft size={20} />
                                    Previous
                                </button>
                                <button
                                    onClick={() => setIsFlipped(!isFlipped)}
                                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all flex items-center gap-2"
                                >
                                    <RotateCw size={20} />
                                    Flip Card
                                </button>
                                <button
                                    onClick={handleNextCard}
                                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all flex items-center gap-2"
                                >
                                    Next
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {mode === 'quiz' && (
                        <motion.div
                            key="quiz"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="max-w-3xl mx-auto"
                        >
                            {!quizComplete ? (
                                <>
                                    {/* Question Progress */}
                                    <div className="mb-8">
                                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                                            <span>Question {quizProgress.currentQuestion + 1} of {quizQuestions.length}</span>
                                            <span>Score: {quizProgress.score}/{quizProgress.currentQuestion}</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full transition-all duration-300"
                                                style={{ width: `${((quizProgress.currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Question Card */}
                                    <div className="bg-slate-900 rounded-3xl p-8 border border-slate-700 shadow-2xl mb-8">
                                        <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-semibold mb-4 border border-amber-500/30">
                                            {currentQuestion.category}
                                        </span>
                                        <h2 className="text-2xl font-bold text-white mb-6">
                                            {currentQuestion.question}
                                        </h2>

                                        <div className="space-y-3">
                                            {currentQuestion.options.map((option, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleQuizAnswer(index)}
                                                    className="w-full text-left p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 transition-all text-white font-medium"
                                                >
                                                    <span className="mr-3 text-slate-500">{String.fromCharCode(65 + index)}.</span>
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Last Answer Feedback */}
                                    {quizProgress.answers.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`p-4 rounded-xl border ${quizProgress.answers[quizProgress.answers.length - 1].isCorrect
                                                    ? 'bg-green-500/10 border-green-500/30'
                                                    : 'bg-red-500/10 border-red-500/30'
                                                }`}
                                        >
                                            <p className="text-sm text-slate-300">
                                                <strong>Explanation:</strong> {quizQuestions[quizProgress.currentQuestion - 1].explanation}
                                            </p>
                                        </motion.div>
                                    )}
                                </>
                            ) : (
                                /* Quiz Results */
                                <div className="text-center">
                                    <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 animate-pulse">
                                        <Trophy className="w-16 h-16 text-slate-900" />
                                    </div>
                                    <h2 className="text-4xl font-black mb-4">Quiz Complete!</h2>
                                    <p className="text-2xl text-slate-300 mb-8">
                                        You scored <span className="text-amber-400 font-bold">{quizProgress.score}/{quizQuestions.length}</span>
                                    </p>

                                    <div className="w-48 h-48 mx-auto mb-8 relative">
                                        <svg className="transform -rotate-90 w-full h-full">
                                            <circle
                                                cx="96"
                                                cy="96"
                                                r="88"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                fill="none"
                                                className="text-slate-800"
                                            />
                                            <circle
                                                cx="96"
                                                cy="96"
                                                r="88"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 88}`}
                                                strokeDashoffset={`${2 * Math.PI * 88 * (1 - quizPercentage / 100)}`}
                                                className="text-amber-500 transition-all duration-1000"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-5xl font-black text-amber-400">{quizPercentage}%</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-center">
                                        <button
                                            onClick={resetQuiz}
                                            className="px-8 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-900/30"
                                        >
                                            <RotateCw size={20} />
                                            Retake Quiz
                                        </button>
                                        <button
                                            onClick={() => setMode('home')}
                                            className="px-8 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
                                        >
                                            Back to Home
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LearningMaterials;
