import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Gavel,
    Shield,
    Scale,
    User,
    Lock,
    Unlock,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Eye,
    Info,
    RefreshCw,
    Play,
    X,
    ChevronDown,
    Sparkles,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import mockTrialService from '@/services/mockTrialService';

// ============================================
// ROLE CONFIGURATION - Light Theme
// ============================================

const ROLE_CONFIG = {
    'Judge': {
        icon: Gavel,
        gradient: 'from-purple-500 to-purple-700',
        bgLight: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-400',
        badgeColor: 'bg-purple-500/20 text-purple-300',
        ringColor: 'ring-purple-500/40',
        description: 'Presides over the trial, maintains order, delivers rulings.',
        complexity: 5,
        skills: ['Critical Thinking', 'Legal Procedure', 'Impartiality'],
    },
    'Prosecution Lawyer': {
        icon: Scale,
        gradient: 'from-red-500 to-red-700',
        bgLight: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        badgeColor: 'bg-red-500/20 text-red-300',
        ringColor: 'ring-red-500/40',
        description: 'Represents the state, presents evidence for conviction.',
        complexity: 4,
        skills: ['Argumentation', 'Evidence Analysis', 'Public Speaking'],
    },
    'Defense Lawyer': {
        icon: Shield,
        gradient: 'from-blue-500 to-blue-700',
        bgLight: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-400',
        badgeColor: 'bg-blue-500/20 text-blue-300',
        ringColor: 'ring-blue-500/40',
        description: 'Defends the accused, challenges evidence for acquittal.',
        complexity: 4,
        skills: ['Cross-Examination', 'Case Strategy', 'Persuasion'],
    },
};

// ============================================
// ANIMATED COMPLEXITY RING COMPONENT
// ============================================

const ComplexityRing = ({ value, max = 5, colorClass }) => {
    const percentage = (value / max) * 100;
    const circumference = 2 * Math.PI * 18;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
                <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-slate-800"
                />
                <motion.circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className={colorClass}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    style={{ strokeDasharray: circumference }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-300">{value}/{max}</span>
            </div>
        </div>
    );
};

// ============================================
// ROLE CARD COMPONENT - Light Theme
// ============================================

const RoleCard = ({ role, participant, isLocked, index }) => {
    const config = ROLE_CONFIG[role];
    if (!config) return null;

    const Icon = config.icon;
    const isAssigned = !!participant;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className={cn(
                'group relative rounded-2xl border border-slate-700/50 overflow-hidden bg-[#1E293B] shadow-lg hover:shadow-2xl transition-all duration-300',
                isLocked && isAssigned && `ring-2 ${config.ringColor} ring-offset-2 ring-offset-[#0B0E14]`
            )}
        >
            {/* Gradient Top Bar */}
            <div className={cn('h-2 bg-gradient-to-r', config.gradient)} />

            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                        {/* Icon */}
                        <motion.div
                            whileHover={{ rotate: [0, -10, 10, 0] }}
                            transition={{ duration: 0.5 }}
                            className={cn(
                                'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br text-white',
                                config.gradient
                            )}
                        >
                            <Icon className="w-7 h-7" />
                        </motion.div>

                        <div>
                            <h3 className="text-lg font-serif font-bold text-white">{role}</h3>
                            <p className={cn('text-xs font-medium uppercase tracking-wider', config.textColor)}>
                                {isAssigned ? 'Assigned' : 'Available'}
                            </p>
                        </div>
                    </div>

                    {/* Complexity Ring */}
                    <ComplexityRing value={config.complexity} colorClass={config.textColor} />
                </div>

                {/* Description */}
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    {config.description}
                </p>

                {/* Skills */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {config.skills.map((skill) => (
                        <span
                            key={skill}
                            className={cn('px-3 py-1 text-xs font-semibold rounded-full', config.badgeColor)}
                        >
                            {skill}
                        </span>
                    ))}
                </div>

                {/* Assigned User */}
                <AnimatePresence mode="wait">
                    {isAssigned ? (
                        <motion.div
                            key="assigned"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={cn('p-4 rounded-xl border border-slate-700 bg-slate-800/50', config.borderColor)}
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className={cn(
                                    'w-12 h-12 rounded-full flex items-center justify-center',
                                    'text-slate-300 font-bold text-lg shadow-lg border border-slate-700 bg-slate-800'
                                )}>
                                    {participant.email?.[0]?.toUpperCase() || '?'}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white truncate">
                                        {participant.email?.split('@')[0] || 'Unknown'}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">
                                        {participant.email}
                                    </p>
                                </div>

                                {/* Locked Indicator */}
                                {isLocked && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20"
                                    >
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    </motion.div>
                                )}
                            </div>

                            {/* Role Match Score */}
                            {participant.rolePriorityScore && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className={cn('mt-3 flex items-center justify-between px-3 py-2 rounded-lg', config.bgLight)}
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-400" />
                                        <span className="text-xs text-slate-300">Match Score</span>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-amber-600">
                                        {(participant.rolePriorityScore * 100).toFixed(1)}%
                                    </span>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="unassigned"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn('p-6 rounded-xl border-2 border-dashed text-center border-slate-700 bg-slate-800/30')}
                        >
                            <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">Awaiting Assignment</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// ============================================
// COLLAPSIBLE ALGORITHM INFO PANEL
// ============================================

const AlgorithmInfoPanel = ({ version, isOpen, onToggle }) => (
    <div className="mb-6">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1E293B] border border-slate-700/50 hover:border-purple-500/50 hover:bg-slate-800 transition-all shadow-lg group"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-200 group-hover:text-purple-300 transition-colors">How Role Assignment Works</span>
            </div>
            <ChevronDown className={cn('w-5 h-5 text-slate-500 transition-transform', isOpen && 'rotate-180')} />
        </button>

        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="mt-3 p-5 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 text-white">
                        <h4 className="text-sm font-bold mb-3">Fair Role Rotation Algorithm</h4>
                        <ul className="space-y-2 text-sm text-purple-100">
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-300" />
                                Weighted Scarcity Analysis
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-300" />
                                Performance-Based Matching
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-300" />
                                Syllabus Progress Integration
                            </li>
                        </ul>
                        <div className="mt-4 flex items-center gap-2 text-xs text-purple-200">
                            <Info className="w-3 h-3" />
                            <span>Version: {version || 'v1.0.0'}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

// ============================================
// MAIN PAGE COMPONENT
// ============================================

const RoleAssignmentViewPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [showAlgoInfo, setShowAlgoInfo] = useState(false);

    const { data: roomData, isLoading } = useQuery({
        queryKey: ['mockTrial', roomId],
        queryFn: () => mockTrialService.getRoomById(roomId),
    });

    const room = roomData?.data?.room;
    const isLocked = room?.roleAssignment?.isLocked;
    const isOwner = room?.isOwner;
    const algorithmVersion = room?.roleAssignment?.algorithmVersion;

    const roleAssignments = useMemo(() => {
        if (!room?.participants) return {};
        const assignments = {};
        const mainRoles = ['Judge', 'Prosecution Lawyer', 'Defense Lawyer'];
        mainRoles.forEach(role => {
            assignments[role] = room.participants.find(p => p.assignedRole === role) || null;
        });
        return assignments;
    }, [room]);

    const assignMutation = useMutation({
        mutationFn: (force) => mockTrialService.assignRoles(roomId, force),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrial', roomId] });
            toast.success('Roles assigned and locked!');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to assign roles');
        },
    });

    const previewMutation = useMutation({
        mutationFn: () => mockTrialService.previewRoles(roomId),
        onSuccess: (data) => {
            setPreviewData(data.data?.assignments || []);
            setShowPreview(true);
        },
    });

    const unlockMutation = useMutation({
        mutationFn: () => mockTrialService.unlockRoles(roomId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrial', roomId] });
            toast.success('Roles unlocked for reassignment');
        },
    });

    const statusMutation = useMutation({
        mutationFn: (status) => mockTrialService.updateStatus(roomId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrial', roomId] });
            toast.success('Room status updated!');
        },
    });

    const acceptedCount = room?.participants?.filter(p => p.status === 'Accepted').length || 0;
    const assignedCount = Object.values(roleAssignments).filter(Boolean).length;
    const allRolesAssigned = assignedCount === 3;



    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-32">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8"
            >
                <div>
                    <h1 className="text-2xl lg:text-3xl font-serif font-bold text-gray-900 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                            <Gavel className="w-6 h-6 text-white" />
                        </div>
                        Role Assignment
                    </h1>
                    <p className="text-gray-500 mt-2">{room?.topic}</p>
                </div>

                {/* Status Badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                        'px-5 py-3 rounded-2xl font-semibold flex items-center gap-3 border',
                        isLocked
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                    )}
                >
                    {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                    <span>{isLocked ? 'Roles Locked' : 'Pending Assignment'}</span>
                    <span className="text-xs bg-white px-2 py-1 rounded-lg border">
                        {assignedCount}/3
                    </span>
                </motion.div>
            </motion.div>

            {/* Algorithm Info Panel */}
            <AlgorithmInfoPanel
                version={algorithmVersion}
                isOpen={showAlgoInfo}
                onToggle={() => setShowAlgoInfo(!showAlgoInfo)}
            />

            {/* Warning Banner */}
            {acceptedCount < 3 && !isLocked && isOwner && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-4"
                >
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800 flex-1">
                        <strong>3 participants required</strong> for role assignment. Currently have {acceptedCount}.
                    </p>
                    <button
                        onClick={() => navigate(`/mock-trials/${roomId}/invite`)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all"
                    >
                        Invite More
                    </button>
                </motion.div>
            )}

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(roleAssignments).map(([role, participant], index) => (
                    <RoleCard
                        key={role}
                        role={role}
                        participant={participant}
                        isLocked={isLocked}
                        index={index}
                    />
                ))}
            </div>

            {/* Fixed Bottom Action Bar */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg"
            >
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Progress Indicator */}
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'w-3 h-3 rounded-full transition-all',
                                            i < assignedCount
                                                ? 'bg-green-500 scale-110'
                                                : 'bg-gray-200'
                                        )}
                                    />
                                ))}
                            </div>
                            <span className="text-sm text-gray-600">
                                {assignedCount}/3 Roles Assigned
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            {!isLocked ? (
                                isOwner && (
                                    <>
                                        <button
                                            onClick={() => previewMutation.mutate()}
                                            disabled={previewMutation.isPending || acceptedCount < 3}
                                            className="px-5 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 border border-gray-300"
                                        >
                                            {previewMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                            Preview
                                        </button>
                                        <button
                                            onClick={() => assignMutation.mutate(false)}
                                            disabled={assignMutation.isPending || acceptedCount < 3}
                                            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                                        >
                                            {assignMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Lock className="w-4 h-4" />
                                            )}
                                            Lock Assignments
                                        </button>
                                    </>
                                )
                            ) : (
                                <>
                                    {isOwner && room.roomStatus === 'RolesAssigned' && (
                                        <button
                                            onClick={() => statusMutation.mutate('Live')}
                                            disabled={statusMutation.isPending}
                                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
                                        >
                                            {statusMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Zap className="w-4 h-4" />
                                            )}
                                            Start Live Trial
                                        </button>
                                    )}
                                    {room.roomStatus === 'Live' && (
                                        <button
                                            onClick={() => navigate(`/courtroom/${roomId}`)}
                                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg animate-pulse"
                                        >
                                            <Gavel className="w-4 h-4" />
                                            Join Trial Room
                                        </button>
                                    )}
                                    {isOwner && room.roomStatus === 'RolesAssigned' && (
                                        <button
                                            onClick={() => unlockMutation.mutate()}
                                            disabled={unlockMutation.isPending}
                                            className="px-5 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all flex items-center gap-2 border border-gray-300"
                                        >
                                            {unlockMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-4 h-4" />
                                            )}
                                            Unlock & Reassign
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Preview Modal */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-lg bg-white border border-gray-200 rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-serif font-bold text-gray-900">Algorithm Preview</h3>
                                        <p className="text-sm text-gray-500">Proposed role assignments</p>
                                    </div>
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
                                {previewData.map((assignment, idx) => {
                                    const config = ROLE_CONFIG[assignment.role];
                                    if (!config) return null;
                                    return (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className={cn('p-4 rounded-2xl border-2', config.bgLight, config.borderColor)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br', config.gradient)}>
                                                        {React.createElement(config.icon, { className: 'w-5 h-5' })}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{assignment.email?.split('@')[0]}</p>
                                                        <p className="text-xs text-gray-500">→ {assignment.role}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-amber-600">
                                                        {(assignment.priorityScore * 100).toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            <div className="p-6 border-t border-gray-200 flex gap-3">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPreview(false);
                                        assignMutation.mutate(false);
                                    }}
                                    className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Lock className="w-4 h-4" />
                                    Confirm & Lock
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RoleAssignmentViewPage;
