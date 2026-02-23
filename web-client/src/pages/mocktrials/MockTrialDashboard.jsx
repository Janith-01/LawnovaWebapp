import React, { useState, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setInvitations, removeInvitation } from '@/store/slices/notificationSlice';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    Plus,
    Calendar,
    Clock,
    Gavel,
    BookOpen,
    CheckCircle,
    Users,
    ChevronRight,
    Zap,
    Target,
    Award,
    ArrowRight,
    Video,
    Edit3,
    Trash2,
    X,
    MoreVertical,
    Eye,
    UserPlus,
    Lock,
    Unlock,
    Loader2,
    AlertTriangle,
    Search,
    Filter,
    Bell,
    XCircle,
    Mail,
    Info,
    Brain,
    Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import mockTrialService from '@/services/mockTrialService';
import { toast } from 'sonner';
import {
    MetricCardSkeleton,
    SessionCardSkeleton,
    ChartSkeleton,
    TableRowSkeleton,
} from '@/components/ui/Skeleton';
import MetricCard from '@/components/ui/MetricCard';

// ============================================
// CONSTANTS
// ============================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

const STATUS_COLORS = {
    Scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    RolesAssigned: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Live: 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse',
    Completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    Cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'sessions', label: 'Manage Sessions' },
];

// ============================================
// DELETE CONFIRMATION MODAL
// ============================================

const DeleteModal = ({ isOpen, onClose, onConfirm, session, isDeleting }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-[#1E293B] rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-700/50"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-900/40 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white">Delete Session?</h3>
                        <p className="text-sm text-slate-400">This action cannot be undone.</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
                    <p className="font-medium text-white">{session?.topic}</p>
                    <p className="text-sm text-slate-400 mt-1">
                        {session?.scheduledDate && new Date(session.scheduledDate).toLocaleDateString()}
                        {session?.scheduledTime && ` at ${session.scheduledTime}`}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ============================================
// EDIT MODAL
// ============================================

const EditModal = ({ isOpen, onClose, session, onSave, isSaving }) => {
    const [formData, setFormData] = useState({
        topic: session?.topic || '',
        description: session?.description || '',
        scheduledDate: session?.scheduledDate ? new Date(session.scheduledDate).toISOString().split('T')[0] : '',
        scheduledTime: session?.scheduledTime || '',
        agenda: session?.agenda || '',
    });

    React.useEffect(() => {
        if (session) {
            setFormData({
                topic: session.topic || '',
                description: session.description || '',
                scheduledDate: session.scheduledDate ? new Date(session.scheduledDate).toISOString().split('T')[0] : '',
                scheduledTime: session.scheduledTime || '',
                agenda: session.agenda || '',
            });
        }
    }, [session]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            topic: formData.topic,
            description: formData.description,
            scheduledDate: formData.scheduledDate,
            scheduledTime: formData.scheduledTime,
            agenda: formData.agenda,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-[#1E293B] rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto border border-slate-700/50"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-xl text-white">Edit Session</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Trial Name *
                        </label>
                        <input
                            type="text"
                            value={formData.topic}
                            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none resize-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Date *
                            </label>
                            <input
                                type="date"
                                value={formData.scheduledDate}
                                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Time *
                            </label>
                            <input
                                type="time"
                                value={formData.scheduledTime}
                                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Agenda
                        </label>
                        <textarea
                            value={formData.agenda}
                            onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none resize-none font-mono text-sm transition-all"
                            placeholder="1. Opening statements&#10;2. Evidence presentation&#10;..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

// ============================================
// SESSION ROW COMPONENT (for table)
// ============================================

const SessionRow = ({ session, isOwner, onEdit, onDelete, onView, onInvite, onAssignRoles }) => {
    const [showMenu, setShowMenu] = useState(false);
    const navigate = useNavigate();

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const statusConfig = STATUS_COLORS[session.roomStatus] || STATUS_COLORS.Scheduled;

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors group"
        >
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg shadow-purple-900/20">
                        <Gavel className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-semibold text-white line-clamp-1 group-hover:text-purple-400 transition-colors">{session.topic}</p>
                        <p className="text-xs text-slate-400 line-clamp-1">{session.description || 'No description'}</p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    {formatDate(session.scheduledDate)}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {session.scheduledTime || '-'}
                </div>
            </td>
            <td className="px-4 py-4">
                <span className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                    statusConfig
                )}>
                    {session.roomStatus}
                </span>
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-300">
                        {session.acceptedCount || 0}/{session.participantCount || session.participants?.length || 0}
                    </span>
                    {session.roleAssignment?.isLocked && (
                        <Lock className="w-3.5 h-3.5 text-purple-400 ml-1" />
                    )}
                </div>
            </td>
            <td className="px-4 py-4">
                <div className="relative">
                    <div className="flex items-center gap-1">
                        {/* Quick Actions */}
                        <button
                            onClick={() => onView(session)}
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-purple-400"
                            title="View"
                        >
                            <Eye className="w-4 h-4" />
                        </button>

                        {isOwner && session.roomStatus !== 'Completed' && (
                            <>
                                <button
                                    onClick={() => onEdit(session)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                                    title="Edit"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onAssignRoles(session)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-orange-400"
                                    title="Assign Roles"
                                >
                                    <Zap className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onInvite(session)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-green-400"
                                    title="Invite Participants"
                                >
                                    <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(session)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-red-400"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </td>
        </motion.tr>
    );
};

// ============================================
// SESSIONS TABLE COMPONENT
// ============================================

const SessionsTable = ({ sessions, isLoading, userId, onEdit, onDelete, onView, onInvite, onAssignRoles }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredSessions = useMemo(() => {
        if (!sessions) return [];

        return sessions.filter(session => {
            const matchesSearch = session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                session.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || session.roomStatus === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [sessions, searchQuery, statusFilter]);

    if (isLoading) {
        return (
            <div className="bg-[#1E293B] rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                <table className="w-full">
                    <thead className="bg-slate-800 border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Session</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Schedule</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Participants</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableRowSkeleton columns={5} />
                        <TableRowSkeleton columns={5} />
                        <TableRowSkeleton columns={5} />
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search sessions..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none text-sm transition-all"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none text-sm bg-slate-800/50 text-white transition-all"
                >
                    <option value="all">All Status</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="RolesAssigned">Roles Assigned</option>
                    <option value="Completed">Completed</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-[#1E293B] rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Session</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Schedule</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Participants</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <Gavel className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                        <p className="text-slate-500">No sessions found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSessions.map((session) => (
                                    <SessionRow
                                        key={session._id || session.id}
                                        session={session}
                                        isOwner={session.ownerId === userId || session.isOwner}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        onView={onView}
                                        onInvite={onInvite}
                                        onAssignRoles={onAssignRoles}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Total Count */}
            <p className="text-sm text-slate-500 text-right">
                Showing {filteredSessions.length} of {sessions?.length || 0} sessions
            </p>
        </div>
    );
};

// ============================================
// SESSION CARD COMPONENT (for Overview)
// ============================================

const SessionCard = ({ session, index, onJoin, onAssignRoles, onComplete, isCompleting }) => {
    const isOwner = session.isOwner;
    const isLive = session.roomStatus === 'Live';
    const hasRolesAssigned = session.roleAssignment?.isLocked;

    // Check if current user is a judge in this session
    const isJudge = session.userRole?.toLowerCase() === 'judge' || session.assignedRole?.toLowerCase() === 'judge';

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <motion.div
            variants={itemVariants}
            className={cn(
                'group bg-[#1E293B] rounded-xl border border-slate-700/50 p-4 hover:shadow-2xl hover:border-purple-500/50 transition-all duration-300',
                isLive && 'ring-2 ring-red-500/50 ring-offset-2 ring-offset-[#0B0E14]'
            )}
        >
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-900/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {formatDate(session.scheduledDate).split(' ')[1]}
                    </span>
                    <span className="text-xl font-bold leading-none">
                        {new Date(session.scheduledDate).getDate()}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                            {session.topic}
                        </h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {session.scheduledTime || '10:00 AM'}
                        </span>
                        <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            {session.acceptedCount || 0}/{session.participantCount || 0}
                        </span>
                        {hasRolesAssigned && (
                            <span className="flex items-center gap-1 text-purple-400 font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Roles Set
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onJoin(session)}
                        className="px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    >
                        View
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    {isOwner && session.roomStatus !== 'Completed' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAssignRoles(session); }}
                            className="p-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-all border border-orange-500/20"
                            title="Assign Roles"
                        >
                            <Zap className="w-4 h-4" />
                        </button>
                    )}
                    {/* Complete button: Show only for Owner AND when session is Live (started) */}
                    {isOwner && session.roomStatus === 'Live' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onComplete(session); }}
                            disabled={isCompleting}
                            className="px-3 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-all border border-green-500/20 font-medium text-sm flex items-center gap-1.5 disabled:opacity-50"
                            title="Complete Session - Show learning materials to all participants"
                        >
                            {isCompleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4" />
                            )}
                            Complete
                        </button>
                    )}
                </div>
            </div>
        </motion.div >
    );
};

// ============================================
// PERFORMANCE CHART COMPONENT
// ============================================

const PerformanceChart = ({ isLoading }) => {
    if (isLoading) {
        return <ChartSkeleton />;
    }

    const chartData = [
        { session: 'S1', score: 72, argument: 65 },
        { session: 'S2', score: 78, argument: 72 },
        { session: 'S3', score: 75, argument: 68 },
        { session: 'S4', score: 82, argument: 78 },
        { session: 'S5', score: 88, argument: 85 },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-6 h-full shadow-xl"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-lg text-white">
                    Performance Insights
                </h3>
                <span className="text-xs text-slate-500">Last 5 sessions</span>
            </div>

            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6D28D9" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorArgument" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} domain={[0, 100]} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1F2937',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                            }}
                        />
                        <Area type="monotone" dataKey="score" stroke="#6D28D9" strokeWidth={2} fill="url(#colorScore)" name="Overall Score" />
                        <Area type="monotone" dataKey="argument" stroke="#F97316" strokeWidth={2} fill="url(#colorArgument)" name="Argument Strength" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-xs text-slate-400">Overall Score</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-xs text-slate-400">Argument Strength</span>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================
// NOTIFICATIONS PANEL COMPONENT
// ============================================

const NotificationsPanel = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const dispatch = useDispatch();
    const reduxInvitations = useSelector(state => state.notifications.invitations);

    const { data, isLoading } = useQuery({
        queryKey: ['myInvitations'],
        queryFn: mockTrialService.getMyInvitations,
    });

    useEffect(() => {
        if (data?.data?.invitations) {
            dispatch(setInvitations(data.data.invitations));
        }
    }, [data, dispatch]);

    const invitations = reduxInvitations || [];

    const acceptMutation = useMutation({
        mutationFn: (roomId) => mockTrialService.acceptInvitation(roomId),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
            queryClient.invalidateQueries({ queryKey: ['mockTrialsDashboard'] });
            dispatch(removeInvitation(response.data.roomId || roomId)); // Optimistic/Immediate update
            toast.success('Invitation accepted!');
            // Optional: navigate to the room or waiting room
            // navigate(`/mock-trials/${response.data.roomId}/waiting`);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to accept invitation');
        },
    });

    const declineMutation = useMutation({
        mutationFn: (roomId) => mockTrialService.declineInvitation(roomId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
            dispatch(removeInvitation(roomId)); // Optimistic/Immediate update
            toast.success('Invitation declined');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to decline invitation');
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2].map((i) => (
                    <div key={i} className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-6 animate-pulse">
                        <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
                        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }



    // Mock system notices for demonstration (mixed with real invites)
    const systemNotices = [
        {
            id: 'sys-1',
            type: 'system',
            title: 'System Maintenance Scheduled',
            message: 'LawNova will be undergoing maintenance on Saturday at 2 AM EST.',
            date: new Date().toISOString(),
        }
    ];

    const allNotifications = [
        ...invitations.map(inv => ({ ...inv, type: 'invitation' })),
        // Show system notices for demonstration
        ...systemNotices
    ].sort((a, b) => new Date(b.date || b.invitedAt) - new Date(a.date || a.invitedAt));

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
            <div className="lg:col-span-2 space-y-4">
                <h2 className="font-serif font-bold text-xl text-gray-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-purple-600" />
                    Notifications & Invites
                    {invitations.length > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {invitations.length} New
                        </span>
                    )}
                </h2>

                {allNotifications.length === 0 ? (
                    <div className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-12 text-center shadow-xl">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                            <Bell className="w-8 h-8 text-slate-600" />
                        </div>
                        <h3 className="font-semibold text-white mb-2">
                            All caught up!
                        </h3>
                        <p className="text-slate-400">
                            You have no new notifications or pending invitations.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {allNotifications.map((item) => (
                            <motion.div
                                key={item.roomId || item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                    "bg-[#1E293B] rounded-2xl border p-6 transition-all hover:shadow-2xl",
                                    item.type === 'invitation' ? "border-purple-500/30 bg-purple-900/10" : "border-slate-700/50"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                                        item.type === 'invitation'
                                            ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-purple-900/20"
                                            : "bg-slate-800 text-slate-400 border border-slate-700"
                                    )}>
                                        {item.type === 'invitation' ? <Mail className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h4 className="font-bold text-lg text-white">
                                                    {item.type === 'invitation' ? "Mock Trial Invitation" : item.title}
                                                </h4>
                                                <p className="text-slate-300 mt-1">
                                                    {item.type === 'invitation' ? (
                                                        <span>
                                                            You have been invited to join <strong>{item.topic}</strong> as
                                                            <span className="inline-block mx-1 px-2 py-0.5 bg-purple-900/30 text-purple-300 text-xs font-bold rounded-full border border-purple-500/20">
                                                                {item.invitedRole}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        item.message
                                                    )}
                                                </p>
                                            </div>
                                            <span className="text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(item.invitedAt || item.date).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {item.type === 'invitation' && (
                                            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-purple-400" />
                                                    {new Date(item.scheduledDate).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-purple-400" />
                                                    {item.scheduledTime}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-purple-400" />
                                                    Hosted by {item.ownerName}
                                                </div>
                                            </div>
                                        )}

                                        {item.type === 'invitation' && (
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    onClick={() => acceptMutation.mutate(item.roomId)}
                                                    disabled={acceptMutation.isPending}
                                                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2"
                                                >
                                                    {acceptMutation.isPending && item.roomId === acceptMutation.variables ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <CheckCircle className="w-4 h-4" />
                                                    )}
                                                    Accept Invitation
                                                </button>
                                                <button
                                                    onClick={() => declineMutation.mutate(item.roomId)}
                                                    disabled={declineMutation.isPending}
                                                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 border border-slate-600"
                                                >
                                                    {declineMutation.isPending && item.roomId === declineMutation.variables ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                    Decline
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
            {/* Right Column - Stats or Info */}
            <div className="space-y-6">
                <div className="bg-[#1E293B] rounded-2xl p-6 text-white border border-slate-700/50 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16" />
                    <h3 className="font-serif font-bold text-lg mb-4 flex items-center gap-2 relative z-10">
                        <Info className="w-5 h-5 text-blue-400" />
                        Did you know?
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 relative z-10">
                        Accepting invitations promptly helps the host assign roles and start the trial on time. You can review the case file immediately after accepting.
                    </p>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/30 relative z-10">
                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
                            Pending Actions
                        </p>
                        <p className="text-3xl font-bold text-white">
                            {invitations.length}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================
// QUICK ACTIONS COMPONENT
// ============================================

const QuickActions = ({ onCreateTrial }) => {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#1E293B] rounded-2xl p-6 text-white border border-slate-700/50 shadow-xl"
        >
            <h3 className="font-serif font-bold text-lg mb-4 text-white">Quick Actions</h3>
            <div className="space-y-3">
                <button
                    onClick={onCreateTrial}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all group border border-slate-700/30"
                >
                    <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/20">
                        <Plus className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-slate-200">Create New Trial</span>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-all text-purple-400" />
                </button>

                {/* Flashcards & Quizzes Button */}
                <button
                    onClick={() => navigate('/learning-materials')}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 rounded-xl transition-all group border border-amber-500/30 hover:border-amber-400/50 shadow-lg shadow-amber-500/5"
                >
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-900 rounded-lg shadow-lg shadow-amber-500/30">
                        <Brain className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                        <span className="font-semibold text-white block">Flashcards & Quizzes</span>
                        <span className="text-xs text-amber-400/80">Study smart, master fast</span>
                    </div>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-400" />
                </button>

                {/* Judgment Prediction Button */}
                <button
                    onClick={() => navigate('/judgment-prediction')}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 rounded-xl transition-all group border border-purple-500/30 hover:border-purple-400/50 shadow-lg shadow-purple-500/5"
                >
                    <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-lg shadow-lg shadow-purple-500/30">
                        <Scale className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                        <span className="font-semibold text-white block">AI Verdict Predictor</span>
                        <span className="text-xs text-purple-400/80">Predict case outcomes</span>
                    </div>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-purple-400" />
                </button>

                <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all group border border-slate-700/30">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20">
                        <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-slate-200">Browse Syllabus</span>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-all text-blue-400" />
                </button>
                <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all group border border-slate-700/30">
                    <div className="p-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/20">
                        <Users className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-slate-200">Find Partners</span>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-all text-green-400" />
                </button>
            </div>
        </motion.div>
    );
};

// ============================================
// RECENT SESSIONS PANEL COMPONENT
// ============================================

const RecentSessionsPanel = ({ sessions, isLoading, onViewSession }) => {
    const navigate = useNavigate();

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (time) => {
        if (!time) return '-';
        return time;
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <SessionCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!sessions?.length) {
        return (
            <div className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-12 text-center shadow-xl">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Completed Sessions Yet</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Once you complete mock trial sessions, they will appear here with learning materials and performance insights.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Completed Sessions</h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Review past sessions and access learning materials
                    </p>
                </div>
                <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300 font-medium">
                    {sessions?.length || 0} sessions
                </span>
            </div>

            {/* Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions?.map((session) => (
                    <motion.div
                        key={session?._id || session?.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-5 hover:shadow-2xl hover:border-purple-500/50 transition-all group"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shadow-lg">
                                    <Gavel className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-1">
                                        {session?.topic || 'Untitled Session'}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {session?.completedAt
                                            ? `Completed ${formatDate(session.completedAt)}`
                                            : formatDate(session?.scheduledDate)
                                        }
                                    </p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs font-medium rounded-full border border-slate-700">
                                Completed
                            </span>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Clock className="w-4 h-4 text-slate-500" />
                                <span>{formatTime(session?.scheduledTime)}</span>
                                <span className="text-slate-600">•</span>
                                <span>{session?.duration || 60} mins</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Users className="w-4 h-4 text-slate-500" />
                                <span>{session?.participants?.length || 0} participants</span>
                            </div>
                            {session?.userRole && (
                                <div className="flex items-center gap-2 text-sm text-purple-400 font-medium">
                                    <Award className="w-4 h-4" />
                                    <span>Your Role: {session.userRole}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t border-slate-800">
                            <button
                                onClick={() => onViewSession?.(session)}
                                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                            >
                                <Eye className="w-4 h-4" />
                                View Details
                            </button>
                            <button
                                onClick={() => navigate(`/mock-trials/${session?._id || session?.id}/learning-center`)}
                                className="flex-1 px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-purple-500/20"
                            >
                                <BookOpen className="w-4 h-4" />
                                Learn
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

const MockTrialDashboard = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [editSession, setEditSession] = useState(null);
    const [deleteSession, setDeleteSession] = useState(null);

    // Fetch mock trials
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['mockTrialsDashboard'],
        queryFn: mockTrialService.getMyTrials,
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ roomId, updates }) => mockTrialService.updateRoom(roomId, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrialsDashboard'] });
            toast.success('Session updated successfully!');
            setEditSession(null);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to update session');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (roomId) => mockTrialService.deleteRoom(roomId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrialsDashboard'] });
            toast.success('Session deleted successfully!');
            setDeleteSession(null);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to delete session');
        },
    });

    // Complete session mutation - Triggers learning popup for all participants
    const completeMutation = useMutation({
        mutationFn: (roomId) => mockTrialService.completeSession(roomId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrialsDashboard'] });
            toast.success('Session completed! All participants will receive learning materials.');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to complete session');
        },
    });

    const rooms = useMemo(() => {
        if (!data?.data?.rooms) return { upcoming: [], live: [], completed: [], rolesAssigned: [] };
        return data.data.rooms;
    }, [data]);

    const allSessions = useMemo(() => {
        const live = rooms.live || [];
        const upcoming = rooms.upcoming || [];
        const rolesAssigned = rooms.rolesAssigned || [];
        const completed = rooms.completed || [];
        return [...live, ...rolesAssigned, ...upcoming, ...completed];
    }, [rooms]);

    const upcomingSessions = useMemo(() => {
        const live = rooms.live || [];
        const upcoming = rooms.upcoming || [];
        const rolesAssigned = rooms.rolesAssigned || [];
        return [...live, ...rolesAssigned, ...upcoming].slice(0, 5);
    }, [rooms]);

    const metrics = useMemo(() => {
        const completed = rooms.completed?.length || 0;
        const upcoming = (rooms.upcoming?.length || 0) + (rooms.rolesAssigned?.length || 0) + (rooms.live?.length || 0);
        return {
            upcoming,
            syllabusMastery: 72,
            performanceScore: 85,
            completed,
        };
    }, [rooms]);

    const username = user?.fullName || user?.firstName || 'Student';
    const userId = user?._id || user?.id;

    const handleCreateTrial = () => navigate('/mock-trials/create');

    const handleJoinSession = (session) => {
        handleView(session);
    };

    const handleEdit = (session) => {
        setEditSession(session);
    };

    const handleSaveEdit = (updates) => {
        const roomId = editSession._id || editSession.id;
        updateMutation.mutate({ roomId, updates });
    };

    const handleDelete = (session) => {
        setDeleteSession(session);
    };

    const handleConfirmDelete = () => {
        const roomId = deleteSession._id || deleteSession.id;
        deleteMutation.mutate(roomId);
    };

    const handleView = (session) => {
        if (session.roomStatus === 'Live') {
            navigate(`/courtroom/${session._id || session.id}`);
        } else {
            navigate(`/mock-trials/${session._id || session.id}/roles`);
        }
    };

    const handleInvite = (session) => {
        navigate(`/mock-trials/${session._id || session.id}/invite`);
    };

    const handleAssignRoles = (session) => {
        navigate(`/mock-trials/${session._id || session.id}/roles`);
    };

    const handleCompleteSession = (session) => {
        const roomId = session._id || session.id;
        completeMutation.mutate(roomId);
    };

    return (
        <>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
            >
                {/* Header */}
                <motion.div
                    variants={itemVariants}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-primary-200">
                            Welcome back, {username}!
                        </h1>
                        <p className="text-gray-500 dark:text-primary-400 mt-1">
                            Here's your legal practice overview
                        </p>
                    </div>
                    <button
                        onClick={handleCreateTrial}
                        className="inline-flex items-center gap-2 bg-[#9333EA] hover:bg-[#7E22CE] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl group"
                    >
                        <Zap className="w-5 h-5 group-hover:animate-bounce" />
                        Quick Create
                    </button>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit border border-slate-700/50 backdrop-blur-sm">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                activeTab === tab.id
                                    ? 'bg-slate-700 text-purple-300 shadow-lg border border-slate-600'
                                    : 'text-slate-400 hover:text-white'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Metrics Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {isLoading ? (
                                    <>
                                        <MetricCardSkeleton />
                                        <MetricCardSkeleton />
                                        <MetricCardSkeleton />
                                        <MetricCardSkeleton />
                                    </>
                                ) : (
                                    <>
                                        <MetricCard
                                            title="Upcoming Trials"
                                            value={metrics.upcoming}
                                            subtitle="scheduled this month"
                                            icon={Calendar}
                                            color="purple"
                                            delay={0}
                                        />
                                        <MetricCard
                                            title="Syllabus Mastery"
                                            value={`${metrics.syllabusMastery}%`}
                                            subtitle="legal topics covered"
                                            icon={BookOpen}
                                            trend="up"
                                            trendValue="+5% this week"
                                            color="blue"
                                            delay={0.1}
                                        />
                                        <MetricCard
                                            title="Performance Score"
                                            value={metrics.performanceScore}
                                            subtitle="out of 100"
                                            icon={Target}
                                            trend="up"
                                            trendValue="+3 points"
                                            color="orange"
                                            delay={0.2}
                                        />
                                        <MetricCard
                                            title="Completed Sessions"
                                            value={metrics.completed}
                                            subtitle="total trials"
                                            icon={Award}
                                            color="green"
                                            delay={0.3}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Main Content Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column - Schedule (2/3) */}
                                <div className="lg:col-span-2 space-y-4">
                                    <motion.div variants={itemVariants}>
                                        <h2 className="font-serif font-bold text-xl text-gray-900">
                                            Your Upcoming Schedule
                                        </h2>
                                    </motion.div>

                                    <motion.div variants={containerVariants} className="space-y-3">
                                        {isLoading ? (
                                            <>
                                                <SessionCardSkeleton />
                                                <SessionCardSkeleton />
                                                <SessionCardSkeleton />
                                            </>
                                        ) : upcomingSessions.length === 0 ? (
                                            <motion.div
                                                variants={itemVariants}
                                                className="bg-[#1E293B] rounded-2xl border border-slate-700/50 p-8 text-center shadow-xl"
                                            >
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                                                    <Gavel className="w-8 h-8 text-purple-400" />
                                                </div>
                                                <h3 className="font-semibold text-white mb-2">
                                                    No Upcoming Trials
                                                </h3>
                                                <p className="text-slate-400 mb-4">
                                                    Create your first mock trial to start practicing
                                                </p>
                                                <button
                                                    onClick={handleCreateTrial}
                                                    className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-900/20"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Create Trial
                                                </button>
                                            </motion.div>
                                        ) : (
                                            upcomingSessions.map((session, idx) => (
                                                <SessionCard
                                                    key={session._id || session.id || idx}
                                                    session={session}
                                                    index={idx}
                                                    onJoin={handleJoinSession}
                                                    onAssignRoles={handleAssignRoles}
                                                    onComplete={handleCompleteSession}
                                                    isCompleting={completeMutation.isPending}
                                                />
                                            ))
                                        )}
                                    </motion.div>
                                </div>

                                {/* Right Column - Insights (1/3) */}
                                <div className="space-y-6">
                                    <PerformanceChart isLoading={isLoading} />
                                    <QuickActions onCreateTrial={handleCreateTrial} />
                                </div>
                            </div>
                        </motion.div>
                    ) : activeTab === 'notifications' ? (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <NotificationsPanel />
                        </motion.div>
                    ) : activeTab === 'sessions' ? (
                        <motion.div
                            key="sessions"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <SessionsTable
                                sessions={allSessions}
                                isLoading={isLoading}
                                userId={userId}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onView={handleView}
                                onInvite={handleInvite}
                                onAssignRoles={handleAssignRoles}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>

            {/* Modals */}
            <AnimatePresence>
                {editSession && (
                    <EditModal
                        isOpen={!!editSession}
                        onClose={() => setEditSession(null)}
                        session={editSession}
                        onSave={handleSaveEdit}
                        isSaving={updateMutation.isPending}
                    />
                )}
                {deleteSession && (
                    <DeleteModal
                        isOpen={!!deleteSession}
                        onClose={() => setDeleteSession(null)}
                        onConfirm={handleConfirmDelete}
                        session={deleteSession}
                        isDeleting={deleteMutation.isPending}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default MockTrialDashboard;
