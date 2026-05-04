import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DailyProvider, DailyAudio, useDaily, useParticipantIds, useLocalParticipant, useParticipantProperty, useDailyEvent, useAppMessage } from '@daily-co/daily-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, MicOff, Video, VideoOff, PhoneOff,
    Settings, Users, MessageSquare, ShieldAlert,
    Gavel, Scale, Shield, Loader2, AlertCircle, CheckCircle, Maximize, Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import mockTrialService from '@/services/mockTrialService';
import api from '@/services/api';
import ParticipantView from '@/components/courtroom/ParticipantView';
import GeminiChatSidebar from '@/components/courtroom/GeminiChatSidebar';
import LearningModal from '@/components/courtroom/LearningModal';
import MasterGenerateButton from '@/components/courtroom/MasterGenerateButton';
import CourtroomTimer from '@/components/courtroom/CourtroomTimer';
import { useAuth } from '@/context/AuthContext';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

const isSecureBrowserContext = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
    return window.isSecureContext === true;
};

// ============================================
// COURTROOM INTERFACE COMPONENT
// ============================================

const CourtroomInterface = ({ roomId, roomInfo, token }) => {
    const { user } = useAuth();
    const daily = useDaily();
    const navigate = useNavigate();
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [chatOpen, setChatOpen] = useState(true); // Gemini Chat Sidebar - default open on left
    const [isActive, setIsActive] = useState(false); // User Activation State
    const [isCompletingSession, setIsCompletingSession] = useState(false);
    const [shouldNavigateToDashboard, setShouldNavigateToDashboard] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSessionStarted, setIsSessionStarted] = useState(false); // Tracks if Daily.co meeting has joined
    const [isTriggeringLearning, setIsTriggeringLearning] = useState(false);

    // Confirmation states for toast-based confirmations
    const [completeConfirmPending, setCompleteConfirmPending] = useState(false);
    const [leaveConfirmPending, setLeaveConfirmPending] = useState(false);

    // Ref for targeted fullscreen on courtroom container only
    const courtroomRef = useRef(null);

    const participantIds = useParticipantIds();
    const localParticipant = useLocalParticipant();
    const isMicReallyOn = localParticipant?.audio;
    const isVideoOn = localParticipant?.video;

    // REQUIREMENT: Technical Integrity - Handle "Mic in Use" and "Permissions" errors via event listeners
    useDailyEvent('camera-error', (ev) => {
        const errorType = ev.error?.type;
        const msg = ev.error?.msg || '';

        if (errorType === 'mic-in-use' || msg.includes('Permission denied')) {
            toast.error("Another application is using your microphone or access was denied. Please close other apps and refresh.", {
                duration: 5000,
                icon: <AlertCircle className="w-5 h-5" />
            });
        } else if (errorType === 'cam-in-use') {
            toast.error("Your camera is being used by another application.", { duration: 5000 });
        } else if (errorType === 'permissions') {
            toast.error("Microphone/Camera access was denied by the browser. Please check your settings.");
        }
    });

    // Listen for custom app messages (for Syncing toast)
    useAppMessage({
        onAppMessage: useCallback((ev) => {
            const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            if (msg?.type === 'SYNCING') {
                toast.loading('Syncing...', { duration: 3000, id: 'sync-toast' });
            } else if (msg?.type === 'STUDY_MATERIAL_AVAILABLE') {
                toast.dismiss('sync-toast');
                toast.success('AI Data Synced successfully!');
                // Requirement: Trigger Global UI state (Learning Modal)
                setIsTriggeringLearning(true);
            }
        }, [])
    });

    // REQUIREMENT: Live Transcription Ingestion for RAG pipeline
    useDailyEvent('transcription-message', useCallback((ev) => {
        if (!ev.text || !roomId) return;

        // Identify speaker details from Daily participant
        const speakerId = ev.participantId;
        const speaker = daily.participants()[speakerId];
        let role = 'Participant';
        let name = speaker?.user_name || 'Anonymous';

        if (name.includes('|')) {
            const parts = name.split('|');
            role = parts[0];
            name = parts[1];
        }

        // Async Ingestion to AI Service (via Gateway)
        api.post('/api/ai/transcript/ingest', {
            type: 'TRANSCRIPTION_MESSAGE',
            sessionId: roomId,
            message: {
                speakerRole: role,
                speakerName: name,
                text: ev.text,
                timestamp: new Date().toISOString(),
                confidence: ev.confidence
            }
        }).catch(err => console.debug('[Transcript] Ingestion skip:', err.message));
    }, [daily, roomId]));

    // Owner check for Complete Session button
    const isOwner = useMemo(() => {
        return !!roomInfo?.isOwner;
    }, [roomInfo]);

    // Permissions check for Judge
    const isJudge = useMemo(() => {
        if (isOwner) return true;
        const currentUserId = user?.id || user?._id;
        const currentUserEmail = user?.email;
        const me = roomInfo?.participants?.find(p =>
            (currentUserId && p.userId === currentUserId) ||
            (currentUserEmail && p.email === currentUserEmail)
        );
        const role = me?.assignedRole || me?.invitedRole || '';
        return role.toLowerCase() === 'judge';
    }, [roomInfo, isOwner, user]);

    // Sorted Participant IDs for the Grid
    const sortedParticipantIds = useMemo(() => {
        if (!daily) return [];
        const parts = Object.values(daily.participants() || {});
        return parts.sort((a, b) => {
            const getRole = (p) => {
                const userName = p?.user_name || '';
                return userName.includes('|') ? userName.split('|')[0] : 'Participant';
            };
            const roleA = getRole(a);
            const roleB = getRole(b);

            // Judge/Owner priority
            if (roleA === 'Judge' || roleA === 'Owner') return -1;
            if (roleB === 'Judge' || roleB === 'Owner') return 1;

            // Counsel priority
            if (roleA.includes('Lawyer')) return -1;
            if (roleB.includes('Lawyer')) return 1;

            return 0;
        }).map(p => p.session_id);
    }, [participantIds, daily]);

    // Join the meeting (Muted)
    const joinMeeting = useCallback(async () => {
        if (!daily || !token) return;

        try {
            if (!isSecureBrowserContext()) {
                const msg = 'Camera/mic and WebRTC require HTTPS in production. Open this app via an HTTPS domain.';
                console.error('[Courtroom] Insecure context detected:', window.location.origin);
                setError(msg);
                toast.error(msg, { duration: 7000 });
                return;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const msg = 'This browser does not support media devices for WebRTC sessions.';
                console.error('[Courtroom] mediaDevices API unavailable');
                setError(msg);
                toast.error(msg, { duration: 7000 });
                return;
            }

            setIsJoining(true);
            // REQUIREMENT: Muted Join to prevent NotAllowedError
            await daily.join({
                url: roomInfo.dailyRoomUrl,
                token: token,
                userName: user?.fullName || user?.email || 'Participant',
                startAudioOff: true,
                startVideoOff: true,
            });

            // SESSION STATE TRACKING: Mark session as started once joined successfully
            setIsSessionStarted(true);
            console.log('[Courtroom] Session started - Daily.co meeting joined successfully');

            setIsJoining(false);
        } catch (err) {
            console.error('Join Error:', err);
            setError('Failed to connect to the courtroom servers.');
            setIsJoining(false);
        }
    }, [daily, token, roomInfo.dailyRoomUrl]);

    useEffect(() => {
        joinMeeting();
    }, [joinMeeting]);

    // Socket.io listener for session completion
    useEffect(() => {
        const socketAuthToken = localStorage.getItem('accessToken');
        const socket = io(SOCKET_URL, {
            auth: { token: socketAuthToken },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('[Courtroom] Socket connected for completion events');
            socket.emit('join:room', { roomId });
        });

        // Resilience: log socket failures so they are visible in devtools
        socket.on('connect_error', (err) => {
            console.warn('[Courtroom] Socket connection error - fallback polling active:', err.message);
            if (err.message?.toLowerCase().includes('authentication')) {
                toast.warning('Realtime sync needs valid login token. Please re-login if this keeps happening.');
            }
        });

        // TIME_INFLATED is handled by CourtroomTimer via Daily.co (single source of truth)
        // to avoid duplicate toasts and ensure stageEndTime ref is updated atomically.

        // Listen for trial completion event (from owner completing session)
        socket.on('room:completed', async (data) => {
            if (data?.roomId === roomId) {
                console.log('[Courtroom] Session completed by owner:', data.completedBy);
                toast.info('Trial session has been completed.');

                // STEP 1: FULLSCREEN EXIT - Restore standard dashboard view
                try {
                    if (document.fullscreenElement) {
                        await document.exitFullscreen();
                        console.log('[Courtroom] Exited fullscreen mode');
                    }
                } catch (fsErr) {
                    console.warn('[Courtroom] Could not exit fullscreen:', fsErr);
                }

                // STEP 2: HARDWARE RELEASE - Destroy Daily.co meeting (camera/mic off)
                try {
                    if (daily) {
                        await daily.destroy();
                        console.log('[Courtroom] Daily.co meeting destroyed - hardware released');
                    }
                } catch (dailyErr) {
                    console.warn('[Courtroom] Could not destroy Daily meeting:', dailyErr);
                }

                // STEP 3-6: UI will handle popup display via SHOW_LEARNING_POPUP socket event
                // Set flag to navigate after learning popup is shown
                setShouldNavigateToDashboard(true);

                // Auto-navigate after 60 seconds if user doesn't close popup
                setTimeout(() => {
                    navigate('/dashboard');
                }, 60000);
            }
        });

        return () => {
            socket.emit('leave:room', { roomId });
            socket.disconnect();
        };
    }, [roomId, daily, navigate]);

    // Track fullscreen state changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    // REQUIREMENT: User Activation with Permission Fallback
    const enterCourtroom = async () => {
        if (!isSecureBrowserContext()) {
            toast.error('Camera/mic access requires HTTPS on mobile browsers. Please use an HTTPS URL for this site.', {
                duration: 7000,
            });
            setIsActive(true); // continue in observer mode
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast.error('This browser cannot access camera/microphone APIs. Joined as observer mode.');
            setIsActive(true);
            return;
        }

        // First, check if browser permissions are available at all
        let hasMediaPerms = false;

        try {
            // Try to get explicit permission first (this triggers the browser prompt)
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            // If successful, stop the temp stream immediately
            stream.getTracks().forEach(track => track.stop());
            hasMediaPerms = true;
        } catch (permErr) {
            console.warn('Media permissions not granted:', permErr.name);
            // User denied or system blocked - continue as observer
        }

        if (hasMediaPerms) {
            try {
                await daily.setLocalAudio(true);
                await daily.setLocalVideo(true);
                toast.success('You have entered the courtroom with camera/mic enabled.');
            } catch (dailyErr) {
                console.error('Daily device activation failed:', dailyErr);
                toast.warning('Joined as observer. Camera/mic unavailable.');
            }
        } else {
            toast.info('Joined as Observer. Camera/mic access denied by system.');
        }

        // Proceed to courtroom regardless of media status
        setIsActive(true);

        // Trigger targeted fullscreen mode on courtroom container
        try {
            if (courtroomRef.current) {
                if (courtroomRef.current.requestFullscreen) {
                    await courtroomRef.current.requestFullscreen();
                } else if (courtroomRef.current.webkitRequestFullscreen) {
                    await courtroomRef.current.webkitRequestFullscreen();
                }
            }
        } catch (fsErr) {
            console.warn('Fullscreen not supported or denied:', fsErr);
        }
    };

    // Complete Session (Owner only + Session Started)
    const handleCompleteSession = async () => {
        // Judge-level restriction (includes owners)
        if (!isJudge) {
            toast.error('Only the room owner or the Judge can complete the session');
            return;
        }

        // Session must be started
        if (!isSessionStarted) {
            toast.error('Cannot complete session - session has not started yet');
            return;
        }

        // Toast-based confirmation (double-click pattern)
        if (!completeConfirmPending) {
            setCompleteConfirmPending(true);
            toast.warning('Click "Complete Session" again to confirm. All participants will receive learning materials.', {
                duration: 3000,
            });

            // Reset confirmation state after 3 seconds
            setTimeout(() => setCompleteConfirmPending(false), 3000);
            return;
        }

        // User confirmed - proceed with completion
        setCompleteConfirmPending(false);

        try {
            setIsCompletingSession(true);

            // STEP 1: FULLSCREEN EXIT - Restore standard dashboard view
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                    console.log('[Courtroom] Exited fullscreen mode');
                }
            } catch (fsErr) {
                console.warn('[Courtroom] Could not exit fullscreen:', fsErr);
            }

            // STEP 2: HARDWARE RELEASE - Destroy Daily.co meeting (camera/mic off)
            try {
                if (daily) {
                    await daily.destroy();
                    console.log('[Courtroom] Daily.co meeting destroyed - hardware released');
                }
            } catch (dailyErr) {
                console.warn('[Courtroom] Could not destroy Daily meeting:', dailyErr);
            }

            // STEP 3: BACKEND API CALL - Mark session as complete
            // This triggers socket broadcasts to all participants
            await mockTrialService.completeSession(roomId);
            toast.success('Trial session completed successfully.');

            // STEP 4 & 5: UI OVERLAY & CONTENT LOADING
            // Navigate to dashboard where LearningPopup will appear via SHOW_LEARNING_POPUP socket event
            // Popup displays: Slate Gray background (#1E293B), Inter font
            // Content: Flashcards (Left) and Quiz Portal (Right)
            // STEP 6: MASTERY SYNC happens automatically when quiz is completed
            navigate('/dashboard');
        } catch (err) {
            console.error('[Courtroom] Failed to complete session:', err);
            toast.error('Failed to complete session.');
            setIsCompletingSession(false);
        }
    };

    const handleLeave = async () => {
        // Toast-based confirmation (double-click pattern)
        if (!leaveConfirmPending) {
            setLeaveConfirmPending(true);
            toast.warning('Click "Leave" again to confirm leaving the courtroom.', {
                duration: 3000,
            });

            // Reset confirmation state after 3 seconds
            setTimeout(() => setLeaveConfirmPending(false), 3000);
            return;
        }

        // User confirmed - proceed with leaving
        setLeaveConfirmPending(false);

        try {
            await daily?.leave();
            toast.success('Left courtroom successfully');
            navigate('/dashboard');
        } catch (error) {
            console.error('[Courtroom] Error leaving:', error);
            toast.error('Failed to leave courtroom');
        }
    };

    /**
     * Trigger Learning Generation (Owner Only)
     * Calls AI to analyze the current transcript and generate quizzes for everyone
     */
    const handleTriggerLearning = async () => {
        if (!isJudge) return;

        try {
            setIsTriggeringLearning(true);
            toast.info('AI is generating quizzes based on the current proceedings...', {
                icon: <Brain className="w-4 h-4 text-purple-400" />,
                duration: 4000
            });

            // Latency Feedback: Emit "Syncing..." to all screens
            if (daily) {
                daily.sendAppMessage({ type: 'SYNCING', payload: { message: 'Syncing...' } }, '*');
            }

            // Call the new broadcastStudySuite controller
            // Extended timeout (5 mins) for heavy RAG processing
            const response = await api.post(`/api/mock-trials/rooms/${roomId}/trigger-learning`, {}, { timeout: 300000 });
            console.log('[Courtroom] trigger-learning response:', response.data);

            // Validate JSON Data before broadcasting
            const aiData = response.data?.data;
            if (aiData && Array.isArray(aiData.flashcards) && Array.isArray(aiData.quizzes)) {

                // Global Synchronization: push the data with Daily.co sendAppMessage
                if (daily) {
                    daily.sendAppMessage({
                        type: 'STUDY_MATERIAL_AVAILABLE',
                        payload: aiData
                    }, '*');
                }

                // Show locally for the Judge
                toast.success('Sync complete. Material generated.');
                // Trigger Local modal update
                window.dispatchEvent(new CustomEvent('LOCAL_STUDY_MATERIAL_READY', { detail: aiData }));
            } else {
                toast.error('AI returned invalid data structure.');
            }

        } catch (err) {
            console.error('[Courtroom] Failed to trigger learning:', err);
            if (err.code === 'ECONNABORTED') {
                toast.error('The AI is taking a bit longer than expected to process the legal complexity. Please try again in a moment.', {
                    duration: 6000
                });
            } else {
                toast.error('Failed to generate quizzes. Ensure there is enough transcript data.');
            }
        } finally {
            setIsTriggeringLearning(false);
        }
    };

    // Toggle Media
    const toggleAudio = useCallback(() => {
        if (!daily) return;
        const currentAudio = daily.localAudio();
        daily.setLocalAudio(!currentAudio);
    }, [daily]);

    const toggleVideo = useCallback(() => {
        if (!daily) return;
        const currentVideo = daily.localVideo();
        daily.setLocalVideo(!currentVideo);
    }, [daily]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-6">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Courtroom Connection Error</h1>
                <p className="text-gray-400 mb-6">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-purple-600 rounded-xl font-bold"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    // Lobby / Activation Screen
    if (!isActive && !isJoining) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center shadow-2xl">
                    <div className="mb-6 flex justify-center">
                        <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center">
                            <Shield className="w-10 h-10 text-purple-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-white mb-2">Secure Entry Required</h2>
                    <p className="text-gray-400 text-sm mb-8">
                        The courtroom session is ready. Please activate your media equipment to enter the legal proceedings.
                    </p>
                    <button
                        onClick={enterCourtroom}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all group lg:hover:scale-[1.02]"
                    >
                        Enter Courtroom
                        <Gavel className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </button>
                    <p className="mt-4 text-[10px] text-gray-600 uppercase tracking-widest font-black">
                        Encrypted Connection • Role: {roomInfo.userRole}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden select-none">
            {/* Top Navigation Bar */}
            <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md px-6 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Gavel className="w-5 h-5 text-purple-500" />
                        <h1 className="font-serif font-bold text-white text-lg tracking-tight">
                            LAWNOVA <span className="text-gray-500 font-sans font-medium text-sm ml-2">| COURTROOM</span>
                        </h1>
                    </div>
                </div>

                <div className="flex-1 flex justify-center">
                    <CourtroomTimer roomId={roomId} isJudge={isJudge} />
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-gray-800 rounded-xl px-4 py-1.5 border border-gray-700">
                        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider block">Case</span>
                        <span className="text-white text-sm font-bold truncate max-w-[200px]">{roomInfo.topic}</span>
                    </div>
                </div>
            </header>

            {/* Courtroom Container - Targeted for fullscreen */}
            <div
                ref={courtroomRef}
                className={cn(
                    "flex-1 flex flex-col overflow-hidden relative",
                    isFullscreen && "!w-screen !h-screen"
                )}
            >
                <main className="flex-1 flex overflow-hidden relative">
                    {/* LEFT: Gemini Chat Sidebar (Fixed 300px) */}
                    <AnimatePresence>
                        {chatOpen && (
                            <motion.div
                                initial={{ x: -320, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -320, opacity: 0 }}
                                className="flex-none w-[300px] h-full"
                            >
                                <GeminiChatSidebar
                                    roomId={roomId}
                                    isOpen={chatOpen}
                                    onClose={() => setChatOpen(false)}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* RIGHT: Video Grid (Flex 1) */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
                            {/* THE BENCH (Judge/Owner) */}
                            {sortedParticipantIds.length > 0 && (
                                <div className="flex justify-center h-[50%] min-h-[300px]">
                                    <div className="w-full max-w-3xl">
                                        <ParticipantView
                                            participant={{ session_id: sortedParticipantIds[0] }}
                                            isLocal={sortedParticipantIds[0] === localParticipant?.session_id}
                                            role="JUDGE / PRESIDING"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* COUNSEL / OTHERS GRID */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedParticipantIds.slice(1).map(id => (
                                    <ParticipantView
                                        key={id}
                                        participant={{ session_id: id }}
                                        isLocal={id === localParticipant?.session_id}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <AnimatePresence>
                        {sidebarOpen && (
                            <motion.aside
                                initial={{ x: 350 }}
                                animate={{ x: 0 }}
                                exit={{ x: 350 }}
                                className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-10"
                            >
                                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                                    <h2 className="font-bold text-white flex items-center gap-2">
                                        <Users className="w-4 h-4 text-purple-400" />
                                        Courtroom
                                    </h2>
                                    <span className="bg-purple-500/10 text-purple-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-500/20">
                                        {participantIds.length} ONLINE
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {participantIds.map(id => (
                                        <ParticipantItem key={id} participantId={id} isLocal={id === localParticipant?.session_id} />
                                    ))}
                                </div>

                                {/* CONDITIONAL RENDERING: Show for Judge/Owner AND after session started */}
                                {isJudge && isSessionStarted && (
                                    <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                                        <button
                                            onClick={handleCompleteSession}
                                            disabled={isCompletingSession}
                                            className={cn(
                                                "w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all border shadow-lg shadow-red-900/20",
                                                isCompletingSession
                                                    ? "bg-gray-800 text-gray-500 border-gray-700 cursor-wait"
                                                    : "bg-gradient-to-r from-red-600 to-orange-600 text-white border-red-500/50 hover:from-red-700 hover:to-orange-700"
                                            )}
                                        >
                                            {isCompletingSession ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ShieldAlert className="w-4 h-4" />
                                            )}
                                            Complete Session
                                        </button>
                                        <div className="mt-3 flex items-center justify-center gap-2">
                                            <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
                                            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">
                                                Judge/Owner Only
                                            </span>
                                            <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
                                        </div>
                                    </div>
                                )}
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </main>

                {/* Bottom Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
                    <div className="flex items-center gap-2 p-2 bg-gray-900/90 backdrop-blur-2xl rounded-2xl border border-gray-800 shadow-2xl">
                        <button
                            onClick={toggleAudio}
                            className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                isMicReallyOn ? "bg-gray-800 text-white mic-active" : "bg-red-500 text-white mic-muted"
                            )}
                        >
                            {isMicReallyOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={toggleVideo}
                            className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                isVideoOn ? "bg-gray-800 text-white" : "bg-red-500 text-white"
                            )}
                        >
                            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                        </button>

                        <div className="w-px h-8 bg-gray-800 mx-1" />

                        {/* Owner Action: Master Generate Button */}
                        {isJudge && (
                            <>
                                <MasterGenerateButton
                                    isOwner={isJudge}
                                    isProcessing={isTriggeringLearning}
                                    onClick={handleTriggerLearning}
                                />
                                <div className="w-px h-8 bg-gray-800 mx-1" />
                            </>
                        )}

                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className={cn("w-12 h-12 rounded-xl flex items-center justify-center", sidebarOpen ? "bg-purple-600" : "bg-gray-800")}
                        >
                            <Users className="w-5 h-5 text-white" />
                        </button>

                        <button
                            onClick={() => setChatOpen(!chatOpen)}
                            className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                chatOpen ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" : "bg-gray-800 text-white hover:bg-gray-700"
                            )}
                            title="AI Legal Assistant"
                        >
                            <MessageSquare className="w-5 h-5" />
                        </button>

                        <div className="w-px h-8 bg-gray-800 mx-1" />

                        <button
                            onClick={handleLeave}
                            className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all"
                        >
                            <PhoneOff className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            {/* End Courtroom Container */}

            {/* Join Overlay */}
            <AnimatePresence>
                {isJoining && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-gray-950 flex flex-col items-center justify-center"
                    >
                        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                        <h2 className="mt-4 text-sm font-bold text-gray-500 uppercase tracking-widest">Entering Courtroom...</h2>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Learning Modal - Triggered on session completion or manual trigger */}
            <LearningModal
                roomId={roomId}
                isOpen={isTriggeringLearning || shouldNavigateToDashboard}
                onClose={() => {
                    console.log('Learning modal closed');
                    if (shouldNavigateToDashboard) {
                        navigate('/dashboard');
                    }
                }}
            />
        </div >
    );
};

const ParticipantItem = ({ participantId, isLocal }) => {
    const daily = useDaily();
    const userName = useParticipantProperty(participantId, 'user_name');
    const audioOn = useParticipantProperty(participantId, 'audio');
    const userData = useParticipantProperty(participantId, 'user_data');

    let dispName = userName || 'Participant';
    let role = 'Participant';

    if (dispName.includes('|')) {
        const parts = dispName.split('|');
        role = parts[0];
        dispName = parts[1];
    } else {
        try {
            if (userData) {
                role = JSON.parse(userData).role || 'Participant';
            }
        } catch (e) { }
    }

    // Fallback: if dispName is still a MongoDB ObjectId (24-char hex) or empty, display a friendly label
    const isObjectId = /^[a-f0-9]{24}$/i.test(dispName);
    if (!dispName || dispName === 'anonymous' || isObjectId) {
        dispName = isObjectId ? `User (${dispName.slice(-4)})` : role;
    }

    return (
        <div className="bg-gray-800/40 border border-gray-800 p-3 rounded-xl flex items-center justify-between group hover:bg-gray-800/80 transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-900 shrink-0" />
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-300 truncate">
                        {dispName} {isLocal && '(Me)'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                        {role}
                    </span>
                </div>
            </div>
            {!audioOn && <MicOff className="w-3.5 h-3.5 text-red-400 opacity-60 shrink-0" />}
        </div>
    );
};

// ============================================
// MAIN PAGE VIEW (PROVIDER WRAPPER)
// ============================================

const CourtroomPage = () => {
    const { roomId } = useParams();
    const [roomInfo, setRoomInfo] = useState(null);
    const [token, setToken] = useState(null);
    const [fetchingStatus, setFetchingStatus] = useState('authenticating'); // authenticating | provisioning | ready
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let retryTimer;
        const loadTrialData = async () => {
            try {
                // 1. Fetch room info for the URL
                const roomResp = await mockTrialService.getRoomById(roomId);
                setRoomInfo(roomResp.data.room);

                // 2. Fetch the session token (Daily meeting token)
                const tokenResp = await mockTrialService.getVideoToken(roomId);
                setToken(tokenResp.data.token);

                setFetchingStatus('ready');
            } catch (err) {
                console.error('Courtroom Setup Error:', err);

                // If 500 or 400 (not ready), retry after 3 seconds as requested
                const status = err.response?.status;
                if (status === 500 || status === 400) {
                    setFetchingStatus('provisioning');
                    retryTimer = setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                    }, 3000);
                } else {
                    toast.error('Failed to access courtroom. Please ensure you are a participant.');
                }
            }
        };

        loadTrialData();
        return () => clearTimeout(retryTimer);
    }, [roomId, retryCount]);

    if (fetchingStatus !== 'ready') {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <div className="relative">
                    <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
                    <Gavel className="w-6 h-6 text-purple-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="mt-8 text-xl font-serif font-bold text-white tracking-[0.2em] uppercase">
                    {fetchingStatus === 'provisioning' ? 'Setting up courtroom...' : 'Authenticating Trial'}
                </h2>
                <p className="mt-2 text-gray-500 text-sm animate-pulse italic">
                    {fetchingStatus === 'provisioning' ? 'Provisioning secure meeting bridge...' : 'Verifying legal credentials...'}
                </p>
                {fetchingStatus === 'provisioning' && (
                    <span className="mt-4 text-[10px] text-gray-700 font-mono">Attempting connection: {retryCount + 1}</span>
                )}
            </div>
        );
    }

    return (
        <DailyProvider properties={{ url: roomInfo.dailyRoomUrl }}>
            <DailyAudio />
            <CourtroomInterface
                roomId={roomId}
                roomInfo={roomInfo}
                token={token}
            />
        </DailyProvider>
    );
};

export default CourtroomPage;


