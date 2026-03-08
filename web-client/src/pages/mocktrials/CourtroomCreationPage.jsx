import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    ChevronLeft,
    ChevronRight,
    Check,
    Gavel,
    Calendar,
    FileText,
    Search,
    Clock,
    AlertCircle,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import mockTrialService from '@/services/mockTrialService';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const step1Schema = z.object({
    caseType: z.string().min(1, 'Please select a case type'),
    topic: z.string()
        .min(5, 'Trial name must be at least 5 characters')
        .max(200, 'Trial name cannot exceed 200 characters'),
    description: z.string().max(2000).optional(),
});

// Define validaton logic separately
const validateDateTime = (data, ctx) => {
    if (!data.scheduledDate || !data.scheduledTime) return;

    const date = new Date(data.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate Date
    if (date < today) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Trial date cannot be in the past",
            path: ["scheduledDate"]
        });
        return; // Don't check time if date is invalid
    }

    // Validate Time (if date is today)
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const scheduledDateTime = new Date(date);
    scheduledDateTime.setHours(hours, minutes);

    const now = new Date();
    // Buffer of 5 minutes to prevent instant failures
    const bufferTime = new Date(now.getTime() - 5 * 60000);

    if (scheduledDateTime < bufferTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Scheduled time cannot be in the past",
            path: ["scheduledTime"]
        });
    }
};

// Base object for merging
const step2Base = z.object({
    scheduledDate: z.string().min(1, 'Please select a date'),
    scheduledTime: z.string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time'),
    duration: z.number().min(15).max(60).optional(),
});

// Step 2 Schema with validation (for step validation)
const step2Schema = step2Base.superRefine(validateDateTime);

const step3Schema = z.object({
    agenda: z.string().max(5000).optional(),
});

// Full schema merging OBJECTS first, then applying refinement
const fullSchema = step1Schema
    .merge(step2Base)
    .merge(step3Schema)
    .superRefine(validateDateTime);

// ============================================
// CONSTANTS
// ============================================

const LEGAL_TOPICS = [
    {
        category: 'Criminal Law', topics: [
            'Theft - Penal Code Sec 380',
            'Murder - Penal Code Sec 294',
            'Robbery - Penal Code Sec 380A',
            'Assault - Penal Code Sec 314',
            'Fraud - Penal Code Sec 403',
        ]
    },
    {
        category: 'Civil Law', topics: [
            'Contract Breach - Civil Procedure Code',
            'Property Dispute - Land Development Ordinance',
            'Tort - Negligence',
            'Defamation - Civil Liability',
        ]
    },
    {
        category: 'Family Law', topics: [
            'Divorce Proceedings',
            'Child Custody - Guardianship Ordinance',
            'Maintenance - Matrimonial Rights Act',
        ]
    },
    {
        category: 'Constitutional Law', topics: [
            'Fundamental Rights Violation',
            'Writ Application',
            'Judicial Review',
        ]
    },
    {
        category: 'Commercial Law', topics: [
            'Company Winding Up',
            'Partnership Dispute',
            'Intellectual Property Infringement',
        ]
    },
];

const STEPS = [
    { id: 1, title: 'Case Details', icon: Gavel },
    { id: 2, title: 'Schedule', icon: Calendar },
    { id: 3, title: 'Agenda', icon: FileText },
];

const AGENDA_TEMPLATES = [
    {
        name: 'Standard Trial',
        template: `1. Opening Statements (10 minutes)
   - Prosecution opens
   - Defense opens

2. Prosecution's Case (20 minutes)
   - Present evidence
   - Examine witnesses

3. Cross-Examination (15 minutes)
   - Defense cross-examines prosecution witnesses

4. Defense's Case (20 minutes)
   - Present evidence
   - Examine witnesses

5. Prosecution Cross-Examination (10 minutes)

6. Closing Arguments (10 minutes each)
   - Prosecution closes
   - Defense closes

7. Verdict Discussion (10 minutes)`,
    },
    {
        name: 'Quick Practice',
        template: `1. Opening Statements (5 minutes each)
2. Main Arguments (10 minutes each)
3. Rebuttal (5 minutes each)
4. Closing (5 minutes each)`,
    },
];

// ============================================
// STEPPER COMPONENT
// ============================================

const Stepper = ({ currentStep, steps }) => (
    <div className="flex items-center justify-center mb-8">
        {steps.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const Icon = step.icon;

            return (
                <React.Fragment key={step.id}>
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex flex-col items-center"
                    >
                        <div
                            className={cn(
                                'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
                                isCompleted
                                    ? 'bg-green-500 text-white'
                                    : isActive
                                        ? 'bg-[#9333EA] text-white ring-4 ring-purple-900/30'
                                        : 'bg-slate-700 text-slate-400'
                            )}
                        >
                            {isCompleted ? (
                                <Check className="w-5 h-5" />
                            ) : (
                                <Icon className="w-5 h-5" />
                            )}
                        </div>
                        <span
                            className={cn(
                                'mt-2 text-sm font-medium',
                                isActive ? 'text-purple-400' : 'text-slate-500'
                            )}
                        >
                            {step.title}
                        </span>
                    </motion.div>

                    {idx < steps.length - 1 && (
                        <div
                            className={cn(
                                'w-16 sm:w-24 h-1 mx-2 rounded-full transition-all duration-300',
                                currentStep > step.id ? 'bg-green-500' : 'bg-slate-700'
                            )}
                        />
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

// ============================================
// STEP 1: CASE DETAILS
// ============================================

const Step1CaseDetails = ({ form, searchQuery, setSearchQuery }) => {
    const { register, setValue, watch, formState: { errors } } = form;
    const selectedCaseType = watch('caseType');
    const [expandedCategory, setExpandedCategory] = useState(null);

    const filteredTopics = LEGAL_TOPICS.map(category => ({
        ...category,
        topics: category.topics.filter(topic =>
            topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.category.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter(category => category.topics.length > 0);

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
        >
            {/* Case Type Selection */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-3">
                    Select Case Type from Sri Lankan Legal Syllabus
                </label>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search legal topics..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all bg-[#0F172A] text-white placeholder:text-slate-500"
                    />
                </div>

                {/* Categories */}
                <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-700 rounded-xl p-3 bg-[#0F172A]/30">
                    {filteredTopics.map((category) => (
                        <div key={category.category}>
                            <button
                                type="button"
                                onClick={() => setExpandedCategory(
                                    expandedCategory === category.category ? null : category.category
                                )}
                                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-left transition-all border border-slate-700"
                            >
                                <span className="font-medium text-primary-200">{category.category}</span>
                                <ChevronRight
                                    className={cn(
                                        'w-4 h-4 text-gray-500 transition-transform',
                                        expandedCategory === category.category && 'rotate-90'
                                    )}
                                />
                            </button>

                            <AnimatePresence>
                                {(expandedCategory === category.category || searchQuery) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="ml-4 mt-1 space-y-1 overflow-hidden"
                                    >
                                        {category.topics.map((topic) => (
                                            <button
                                                key={topic}
                                                type="button"
                                                onClick={() => {
                                                    setValue('caseType', topic);
                                                    setValue('topic', topic);
                                                }}
                                                className={cn(
                                                    'w-full p-2 text-left rounded-lg text-sm transition-all',
                                                    selectedCaseType === topic
                                                        ? 'bg-purple-900/40 text-purple-300 font-medium'
                                                        : 'hover:bg-slate-700/50 text-slate-300'
                                                )}
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
                {errors.caseType && (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.caseType.message}
                    </p>
                )}
            </div>

            {/* Custom Trial Name */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-2">
                    Trial Name <span className="text-red-500">*</span>
                </label>
                <input
                    {...register('topic')}
                    placeholder="e.g., State vs. John Doe - Theft Case"
                    className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all bg-[#0F172A] text-white placeholder:text-slate-500',
                        errors.topic
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-700 focus:border-purple-500 focus:ring-purple-900/30'
                    )}
                />
                {errors.topic && (
                    <p className="text-sm text-red-500 mt-1">{errors.topic.message}</p>
                )}
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-2">
                    Case Description
                </label>
                <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Brief background of the case..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all resize-none bg-[#0F172A] text-white placeholder:text-slate-500"
                />
            </div>
        </motion.div>
    );
};

// ============================================
// STEP 2: SCHEDULE
// ============================================

const Step2Schedule = ({ form }) => {
    const { register, formState: { errors } } = form;

    const timeSlots = [
        '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
        >
            {/* Date Selection */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-2">
                    Trial Date <span className="text-red-500">*</span>
                </label>
                <input
                    {...register('scheduledDate')}
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all bg-[#0F172A] text-white',
                        errors.scheduledDate
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-700 focus:border-purple-500 focus:ring-purple-900/30'
                    )}
                />
                {errors.scheduledDate && (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.scheduledDate.message}
                    </p>
                )}
            </div>

            {/* Time Selection */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-2">
                    Start Time <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <input
                        {...register('scheduledTime')}
                        type="time"
                        className={cn(
                            'flex-1 px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all bg-[#0F172A] text-white',
                            errors.scheduledTime
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                                : 'border-slate-700 focus:border-purple-500 focus:ring-purple-900/30'
                        )}
                    />
                </div>

                {/* Quick Time Slots */}
                <p className="text-xs text-gray-500 mb-2">Quick select:</p>
                <div className="flex flex-wrap gap-2">
                    {timeSlots.map((time) => (
                        <button
                            key={time}
                            type="button"
                            onClick={() => form.setValue('scheduledTime', time)}
                            className="px-3 py-1.5 text-sm bg-[#0F172A] text-slate-400 hover:bg-purple-900/40 hover:text-purple-300 border border-slate-700 rounded-lg transition-colors"
                        >
                            {time}
                        </button>
                    ))}
                </div>
                {errors.scheduledTime && (
                    <p className="text-sm text-red-500 mt-2">{errors.scheduledTime.message}</p>
                )}
            </div>

            {/* Duration */}
            <div>
                <label className="block text-sm font-semibold text-navy-800 mb-2">
                    Estimated Duration
                </label>
                <select
                    {...register('duration', { valueAsNumber: true })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all bg-[#0F172A] text-white"
                >
                    <option value={15} className="bg-slate-900">15 minutes</option>
                    <option value={30} className="bg-slate-900">30 minutes</option>
                    <option value={45} className="bg-slate-900">45 minutes</option>
                    <option value={60} className="bg-slate-900">1 hour</option>
                </select>
            </div>

            {/* Info Card */}
            <div className="bg-purple-950/20 border border-purple-900/50 rounded-xl p-4">
                <p className="text-sm text-purple-300">
                    <strong>Tip:</strong> Schedule your trial at least 24 hours in advance
                    to give participants time to prepare their arguments.
                </p>
            </div>
        </motion.div>
    );
};

// ============================================
// STEP 3: AGENDA
// ============================================

const Step3Agenda = ({ form }) => {
    const { register, setValue, watch } = form;
    const currentAgenda = watch('agenda');

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
        >
            {/* Agenda Templates */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-3">
                    Quick Templates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AGENDA_TEMPLATES.map((template) => (
                        <button
                            key={template.name}
                            type="button"
                            onClick={() => setValue('agenda', template.template)}
                            className="p-4 text-left border border-slate-700 hover:border-purple-500/50 hover:bg-purple-900/20 rounded-xl transition-all group bg-slate-800/30"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="font-medium text-primary-200">{template.name}</span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">
                                {template.template.split('\n')[0]}...
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Rich Text Editor (simplified) */}
            <div>
                <label className="block text-sm font-semibold text-primary-200 mb-2">
                    Trial Agenda
                </label>
                <textarea
                    {...register('agenda')}
                    rows={12}
                    placeholder="Define the structure of your mock trial session...

Example:
1. Opening Statements (10 min each)
2. Prosecution presents evidence
3. Cross-examination
4. Defense presents case
5. Closing arguments
6. Verdict discussion"
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all resize-none font-mono text-sm bg-[#0F172A] text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                    {currentAgenda?.length || 0}/5000 characters
                </p>
            </div>
        </motion.div>
    );
};

// ============================================
// MAIN CREATION PAGE
// ============================================

const CourtroomCreationPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const form = useForm({
        resolver: zodResolver(fullSchema),
        defaultValues: {
            caseType: '',
            topic: '',
            description: '',
            scheduledDate: '',
            scheduledTime: '',
            duration: 60,
            agenda: '',
        },
        mode: 'onChange',
    });

    const { handleSubmit, trigger, formState: { isSubmitting } } = form;

    const createMutation = useMutation({
        mutationFn: (data) => mockTrialService.createRoom(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['mockTrials'] });
            toast.success('Courtroom created successfully!');
            // Handle different response structures - backend returns room.id
            const roomId = result.data?.room?.id || result.data?.room?._id || result.data?.roomId || result.roomId || result._id;
            console.log('Room creation response:', result);
            if (roomId) {
                navigate(`/mock-trials/${roomId}/invite`, { state: { roomId } });
            } else {
                console.error('No room ID in response:', result);
                toast.error('Room created but ID not found. Going to dashboard.');
                navigate('/mock-trials');
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to create courtroom');
        },
    });

    const validateStep = async () => {
        let isValid = false;
        switch (currentStep) {
            case 1:
                isValid = await trigger(['caseType', 'topic', 'description']);
                break;
            case 2:
                isValid = await trigger(['scheduledDate', 'scheduledTime', 'duration']);
                break;
            case 3:
                isValid = await trigger(['agenda']);
                break;
            default:
                isValid = true;
        }
        return isValid;
    };

    const handleNext = async () => {
        const isValid = await validateStep();
        if (isValid && currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const onSubmit = (data) => {
        createMutation.mutate(data);
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <h1 className="text-3xl font-bold text-white">
                    Create Virtual Courtroom
                </h1>
                <p className="text-white/70 mt-2">
                    Set up your mock trial session in 3 easy steps
                </p>
            </motion.div>

            {/* Stepper */}
            <Stepper currentStep={currentStep} steps={STEPS} />

            {/* Form Card */}
            <motion.div
                layout
                className="bg-[#1E293B] rounded-2xl border border-[#334155] p-8 shadow-xl"
            >
                <form onSubmit={handleSubmit(onSubmit)}>
                    <AnimatePresence mode="wait">
                        {currentStep === 1 && (
                            <Step1CaseDetails
                                key="step1"
                                form={form}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                            />
                        )}
                        {currentStep === 2 && (
                            <Step2Schedule key="step2" form={form} />
                        )}
                        {currentStep === 3 && (
                            <Step3Agenda key="step3" form={form} />
                        )}
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className={cn(
                                'px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all',
                                currentStep === 1
                                    ? 'text-slate-600 cursor-not-allowed'
                                    : 'text-slate-300 hover:bg-slate-800'
                            )}
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Back
                        </button>

                        {currentStep < 3 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="px-6 py-3 bg-[#9333EA] hover:bg-[#7E22CE] text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg"
                            >
                                Continue
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isSubmitting || createMutation.isPending}
                                className={cn(
                                    'px-8 py-3 bg-[#9333EA] hover:bg-[#7E22CE] text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg',
                                    (isSubmitting || createMutation.isPending) && 'opacity-70 cursor-not-allowed'
                                )}
                            >
                                {(isSubmitting || createMutation.isPending) ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Gavel className="w-5 h-5" />
                                        Create Courtroom
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default CourtroomCreationPage;
