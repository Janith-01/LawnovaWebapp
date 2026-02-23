import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import sessionsService from '@/services/sessionsService';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

// Schema for form validation
const createRoomSchema = z.object({
    title: z.string().min(3, 'Title is required (min 3 chars)'),
    caseType: z.string().min(1, 'Please select a trial topic'),
    scheduledAt: z.string().refine((val) => {
        return new Date(val) > new Date();
    }, 'Date must be in the future'),
    description: z.string().optional(), // Agenda
    invitees: z.array(z.string().email('Invalid email')).optional(),
});

const CreateRoomModal = ({ isOpen, onClose, onSuccess }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [meta, setMeta] = useState(null);
    const [inviteeInput, setInviteeInput] = useState('');

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        reset,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(createRoomSchema),
        defaultValues: {
            title: '',
            caseType: '',
            scheduledAt: '',
            description: '',
            invitees: [],
        }
    });

    // Load metadata (case types, etc.) when modal opens
    useEffect(() => {
        if (isOpen && !meta) {
            sessionsService.getSessionMeta()
                .then(data => setMeta(data))
                .catch(console.error);
        }
    }, [isOpen, meta]);

    // Reset form when closed
    useEffect(() => {
        if (!isOpen) {
            reset();
            setInviteeInput('');
        }
    }, [isOpen, reset]);

    const invitees = watch('invitees') || [];

    const handleAddInvitee = (e) => {
        e.preventDefault();
        if (!inviteeInput) return;

        // Simple email regex check before adding
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inviteeInput)) {
            toast.error('Please enter a valid email address');
            return;
        }

        if (invitees.includes(inviteeInput)) {
            setInviteeInput('');
            return;
        }

        setValue('invitees', [...invitees, inviteeInput]);
        setInviteeInput('');
    };

    const removeInvitee = (email) => {
        setValue('invitees', invitees.filter(i => i !== email));
    };

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            // 1. Create Draft Session
            const sessionPayload = {
                title: data.title,
                caseType: data.caseType,
                description: data.description,
                scheduledAt: new Date(data.scheduledAt).toISOString(),
                durationMinutes: 60, // Default to 60 or fetch from settings
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                isPrivate: true
            };

            const draftSession = await sessionsService.createDraftSession(sessionPayload);
            const sessionId = draftSession._id || draftSession.id;

            // 2. Invite Participants provided
            if (data.invitees && data.invitees.length > 0) {
                await Promise.all(data.invitees.map(email =>
                    sessionsService.inviteParticipant(sessionId, { identifier: email })
                        .catch(err => console.warn(`Failed to invite ${email}`, err))
                ));
            }

            // 3. Schedule the Session
            await sessionsService.scheduleSession(sessionId);

            toast.success('Courtroom created successfully!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to create room:', error);
            toast.error(error?.response?.data?.error?.message || 'Failed to create courtroom');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create New Courtroom"
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
                {/* Trial Topic & Title */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Session Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('title')}
                            placeholder="e.g. Theft Case - Penal Code Sec 380"
                            className={cn(
                                "w-full rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500",
                                errors.title ? "border-red-500" : "border-gray-200 dark:border-slate-700"
                            )}
                        />
                        {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Trial Topic <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('caseType')}
                            className={cn(
                                "w-full rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-purple-500",
                                errors.caseType ? "border-red-500" : "border-gray-200 dark:border-slate-700"
                            )}
                        >
                            <option value="">Select a topic...</option>
                            {meta?.caseTypes?.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        {errors.caseType && <p className="text-xs text-red-500">{errors.caseType.message}</p>}
                    </div>
                </div>

                {/* Date & Time */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date & Time <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="datetime-local"
                        {...register('scheduledAt')}
                        className={cn(
                            "w-full rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-purple-500",
                            errors.scheduledAt ? "border-red-500" : "border-gray-200 dark:border-slate-700"
                        )}
                        style={{ colorScheme: 'light' }}
                    />
                    {errors.scheduledAt && <p className="text-xs text-red-500">{errors.scheduledAt.message}</p>}
                </div>

                {/* Agenda / Description */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Agenda / Description
                    </label>
                    <textarea
                        {...register('description')}
                        rows={3}
                        placeholder="Outline the trial agenda, key arguments, or specific instructions..."
                        className="w-full resize-none rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                {/* Invitee Emails (Tag Input) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Invite Participants (Email)
                    </label>
                    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 focus-within:ring-2 focus-within:ring-purple-500 transition-all">
                        <div className="flex flex-wrap gap-2">
                            {invitees.map((email) => (
                                <span
                                    key={email}
                                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300"
                                >
                                    {email}
                                    <button
                                        type="button"
                                        onClick={() => removeInvitee(email)}
                                        className="rounded-full p-0.5 hover:bg-purple-200 dark:hover:bg-purple-700"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={inviteeInput}
                                onChange={(e) => setInviteeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddInvitee(e);
                                    }
                                }}
                                placeholder={invitees.length > 0 ? "Add another..." : "Enter email and press Enter"}
                                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">Press Enter after typing an email address.</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-600 focus:ring-2 focus:ring-orange-300 active:bg-orange-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Courtroom'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateRoomModal;
