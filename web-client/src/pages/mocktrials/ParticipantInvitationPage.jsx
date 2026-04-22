import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import {
    Search,
    UserPlus,
    X,
    Mail,
    CheckCircle,
    Clock,
    XCircle,
    Users,
    Send,
    ArrowLeft,
    RefreshCw,
    Loader2,
    User,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import mockTrialService from '@/services/mockTrialService';
import { TableRowSkeleton } from '@/components/ui/Skeleton';

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG = {
    Accepted: {
        color: 'bg-green-500/10 text-green-400 border-green-500/20',
        icon: CheckCircle,
        label: 'Accepted',
    },
    Pending: {
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: Clock,
        label: 'Pending',
    },
    Declined: {
        color: 'bg-red-500/10 text-red-400 border-red-500/20',
        icon: XCircle,
        label: 'Declined',
    },
};

// ============================================
// DIRECTORY CARD COMPONENT
// ============================================

const DirectoryCard = ({ person, onInvite, isInvited }) => {
    const isFaculty = person.type === 'faculty';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                'p-4 rounded-xl border transition-all group',
                isInvited
                    ? 'bg-purple-900/10 border-purple-500/30'
                    : 'bg-[#1E293B] border-slate-700/50 hover:border-purple-500/50 hover:shadow-xl'
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-slate-300 font-bold text-lg shrink-0 border border-slate-700 bg-slate-800'
                )}>
                    {person.avatar || person.name?.[0]}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">{person.name}</p>
                        {isFaculty && (
                            <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded-full shrink-0 border border-slate-700">
                                Faculty
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400 truncate">{person.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{person.department}</p>
                </div>

                <button
                    onClick={() => onInvite(person)}
                    disabled={isInvited}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium text-sm transition-all shrink-0',
                        isInvited
                            ? 'bg-purple-900/30 text-purple-300 cursor-default border border-purple-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    )}
                >
                    {isInvited ? (
                        <span className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Invited
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <UserPlus className="w-4 h-4" />
                            Invite
                        </span>
                    )}
                </button>
            </div>
        </motion.div>
    );
};

// ============================================
// DIRECTORY SKELETON
// ============================================

const DirectorySkeleton = () => (
    <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-700 bg-[#1E293B] animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800" />
                    <div className="flex-1">
                        <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-slate-800/50 rounded w-1/2" />
                    </div>
                    <div className="w-20 h-9 bg-slate-800 rounded-lg" />
                </div>
            </div>
        ))}
    </div>
);

// ============================================
// EMAIL TAG INPUT COMPONENT
// ============================================

const EmailTagInput = ({ emails, setEmails, onSendInvites, isPending }) => {
    const [input, setInput] = useState('');

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const email = input.trim().replace(',', '');
            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !emails.includes(email)) {
                setEmails([...emails, email]);
                setInput('');
            }
        }
    };

    const removeEmail = (email) => {
        setEmails(emails.filter(e => e !== email));
    };

    return (
        <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-white">Invite by Email</span>
            </div>

            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border border-slate-700 bg-[#0F172A] rounded-lg focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-900/30 mb-3 transition-all">
                {emails.map((email) => (
                    <motion.span
                        key={email}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-900/40 text-purple-200 rounded-full text-sm border border-purple-500/20"
                    >
                        {email}
                        <button
                            type="button"
                            onClick={() => removeEmail(email)}
                            className="hover:text-purple-900"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </motion.span>
                ))}
                <input
                    type="email"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={emails.length === 0 ? "Enter email addresses..." : ""}
                    className="flex-1 min-w-[200px] outline-none text-sm bg-transparent text-white"
                />
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                    Press Enter or comma to add an email
                </p>
                <button
                    onClick={onSendInvites}
                    disabled={emails.length === 0 || isPending}
                    className={cn(
                        'px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all',
                        emails.length === 0
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'
                    )}
                >
                    {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    Send Invites
                </button>
            </div>
        </div>
    );
};

// ============================================
// STATUS TABLE COMPONENT
// ============================================

const InviteeTable = ({ participants, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <table className="w-full">
                    <thead className="bg-slate-800/80 border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Email</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableRowSkeleton columns={4} />
                        <TableRowSkeleton columns={4} />
                        <TableRowSkeleton columns={4} />
                    </tbody>
                </table>
            </div>
        );
    }

    if (!participants || participants.length === 0) {
        return (
            <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 p-8 text-center shadow-xl">
                <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400">No participants invited yet</p>
            </div>
        );
    }

    return (
        <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
            <table className="w-full">
                <thead className="bg-slate-800/80 border-b border-slate-700">
                    <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Invitee</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 hidden sm:table-cell">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 hidden md:table-cell">Role</th>
                    </tr>
                </thead>
                <tbody>
                    <AnimatePresence>
                        {participants.map((participant, idx) => {
                            const status = participant.status || 'Pending';
                            const config = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
                            const Icon = config.icon;

                            return (
                                <motion.tr
                                    key={participant._id || participant.email}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="border-t border-slate-800 hover:bg-slate-800/40 group transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs border border-slate-700 shadow-lg shadow-black/20">
                                                {participant.email?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <span className="font-medium text-white group-hover:text-purple-400 transition-colors">
                                                {participant.email?.split('@')[0] || 'Unknown'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                                        {participant.email}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border',
                                            config.color
                                        )}>
                                            <Icon className="w-3 h-3" />
                                            {config.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                                        {participant.assignedRole || participant.invitedRole || 'Unassigned'}
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </AnimatePresence>
                </tbody>
            </table>
        </div>
    );
};

// ============================================
// MAIN PAGE COMPONENT
// ============================================

const ParticipantInvitationPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [externalEmails, setExternalEmails] = useState([]);
    const [directoryInvites, setDirectoryInvites] = useState([]);

    // Get roomId from params or from navigation state (after room creation)
    const effectiveRoomId = roomId || location.state?.roomId;

    // Redirect if no roomId
    useEffect(() => {
        if (!effectiveRoomId) {
            toast.error('No room selected. Please create or select a room first.');
            navigate('/mock-trials');
        }
    }, [effectiveRoomId, navigate]);

    // Fetch room data
    const { data: roomData, isLoading: roomLoading, refetch } = useQuery({
        queryKey: ['mockTrial', effectiveRoomId],
        queryFn: () => mockTrialService.getRoomById(effectiveRoomId),
        enabled: !!effectiveRoomId,
    });

    // Fetch users from directory
    const { data: directoryData, isLoading: directoryLoading } = useQuery({
        queryKey: ['userDirectory', searchQuery, filterType],
        queryFn: () => mockTrialService.searchUsers(searchQuery, filterType, 20),
        enabled: true,
        staleTime: 30000, // Cache for 30 seconds
    });

    const room = roomData?.data?.room;
    const participants = room?.participants || [];
    const directory = directoryData?.data?.users || [];

    // Socket.io for real-time updates
    useEffect(() => {
        if (!effectiveRoomId) return;

        const socketUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            auth: { token: localStorage.getItem('accessToken') },
        });

        socket.on('connect', () => {
            socket.emit('join:room', { roomId: effectiveRoomId });
        });

        socket.on('room:participant:status', () => {
            refetch();
        });

        socket.on('room:invitation:accepted', () => {
            refetch();
            toast.success('A participant has accepted the invitation!');
        });

        return () => {
            socket.emit('leave:room', { roomId: effectiveRoomId });
            socket.disconnect();
        };
    }, [effectiveRoomId, refetch]);

    // Invite mutation
    const inviteMutation = useMutation({
        mutationFn: (emails) => mockTrialService.inviteParticipants(
            effectiveRoomId,
            emails.map(email => ({ email, role: 'Unassigned' }))
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mockTrial', effectiveRoomId] });
            toast.success('Invitations sent successfully!');
            setExternalEmails([]);
            setDirectoryInvites([]);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to send invitations');
        },
    });

    // Filter directory to exclude already invited
    const filteredDirectory = useMemo(() => {
        return directory.filter(person => {
            const notAlreadyInvited = !participants.some(
                p => p.email?.toLowerCase() === person.email.toLowerCase()
            );
            return notAlreadyInvited;
        });
    }, [directory, participants]);

    const handleDirectoryInvite = (person) => {
        if (!directoryInvites.includes(person.email)) {
            setDirectoryInvites([...directoryInvites, person.email]);
        }
    };

    const handleSendInvites = () => {
        const allEmails = [...new Set([...externalEmails, ...directoryInvites])];
        if (allEmails.length > 0) {
            inviteMutation.mutate(allEmails);
        }
    };

    const pendingInviteCount = directoryInvites.length + externalEmails.length;

    if (!effectiveRoomId) {
        return null;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-slate-500 hover:text-purple-400 flex items-center gap-1 text-sm mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <h1 className="text-2xl font-serif font-bold text-white">
                        Invite Participants
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {room?.topic || 'Loading...'}
                    </p>
                </div>

                {pendingInviteCount > 0 && (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={handleSendInvites}
                        disabled={inviteMutation.isPending}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-purple-900/20"
                    >
                        {inviteMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                        Send {pendingInviteCount} Invite{pendingInviteCount !== 1 ? 's' : ''}
                    </motion.button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Directory */}
                <div className="space-y-4">
                    <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-400" />
                                University Directory
                            </h3>
                            <button
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['userDirectory'] })}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search & Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-700 bg-[#0F172A] text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-900/30 outline-none text-sm transition-all"
                                />
                            </div>
                            <div className="flex gap-2">
                                {['all', 'student', 'faculty'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={cn(
                                            'px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize border',
                                            filterType === type
                                                ? 'bg-purple-900/20 text-purple-300 border-purple-500/30'
                                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                        )}
                                    >
                                        {type === 'all' ? 'All' : type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Directory List */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {directoryLoading ? (
                                <DirectorySkeleton />
                            ) : filteredDirectory.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <User className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                                    <p>{searchQuery ? 'No matching users found' : 'No users available'}</p>
                                </div>
                            ) : (
                                filteredDirectory.map((person) => (
                                    <DirectoryCard
                                        key={person.id}
                                        person={person}
                                        onInvite={handleDirectoryInvite}
                                        isInvited={directoryInvites.includes(person.email)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* External Email Input */}
                    <EmailTagInput
                        emails={externalEmails}
                        setEmails={setExternalEmails}
                        onSendInvites={handleSendInvites}
                        isPending={inviteMutation.isPending}
                    />
                </div>

                {/* Right Column - Status Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            Invitation Status
                            <span className="text-sm font-normal text-slate-500">
                                ({participants.length} invited)
                            </span>
                        </h3>
                        <button
                            onClick={() => refetch()}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-purple-400 transition-all"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    <InviteeTable participants={participants} isLoading={roomLoading} />

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl text-center bg-green-500/5 border border-green-500/20 shadow-lg">
                            <p className="text-2xl font-bold text-green-400">
                                {participants.filter(p => p.status === 'Accepted').length}
                            </p>
                            <p className="text-sm text-slate-400">Accepted</p>
                        </div>
                        <div className="p-4 rounded-xl text-center bg-amber-500/5 border border-amber-500/20 shadow-lg">
                            <p className="text-2xl font-bold text-amber-400">
                                {participants.filter(p => p.status === 'Pending' || !p.status).length}
                            </p>
                            <p className="text-sm text-slate-400">Pending</p>
                        </div>
                        <div className="p-4 rounded-xl text-center bg-red-500/5 border border-red-500/20 shadow-lg">
                            <p className="text-2xl font-bold text-red-400">
                                {participants.filter(p => p.status === 'Declined').length}
                            </p>
                            <p className="text-sm text-slate-400">Declined</p>
                        </div>
                    </div>

                    {/* Next Step */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-6 shadow-xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16" />
                        <h4 className="font-semibold text-white mb-2 relative z-10">Ready to proceed?</h4>
                        <p className="text-sm text-slate-400 mb-4 relative z-10">
                            Move to the lobby to finalize roles and begin the session.
                        </p>
                        <button
                            onClick={() => navigate(`/mock-trials/${effectiveRoomId}/waiting`)}
                            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 relative z-10"
                        >
                            Proceed to Waiting Room
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ParticipantInvitationPage;

