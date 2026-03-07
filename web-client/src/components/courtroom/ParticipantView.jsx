import React from 'react';
import { useMediaTrack, useParticipantProperty } from '@daily-co/daily-react';
import { Gavel, Shield, Scale, User, MicOff, CameraOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_ICONS = {
    'Judge': Gavel,
    'Prosecution Lawyer': Scale,
    'Defense Lawyer': Shield,
    'Witness': User,
    'Victim': User,
    'Client': User,
};

const ParticipantView = ({ participant, role, isLocal = false }) => {
    const isVideoOff = !useParticipantProperty(participant.session_id, 'video');
    const isAudioOff = !useParticipantProperty(participant.session_id, 'audio');

    // We still need the video track to render the video
    const videoTrack = useMediaTrack(participant.session_id, 'video');

    const Icon = ROLE_ICONS[role] || User;

    return (
        <div className={cn(
            "relative w-full h-full rounded-2xl overflow-hidden bg-gray-900 border-2 transition-all duration-300",
            role === 'Judge' ? "border-purple-500/50 shadow-lg shadow-purple-500/20" : "border-gray-800"
        )}>
            {/* Video Element */}
            {!isVideoOff ? (
                <video
                    autoPlay
                    muted={isLocal}
                    playsInline
                    ref={(el) => {
                        if (el && videoTrack.track) {
                            el.srcObject = new MediaStream([videoTrack.track]);
                        }
                    }}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
                    <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110",
                        role === 'Judge' ? "bg-purple-600 shadow-xl shadow-purple-900/40" : "bg-gray-700"
                    )}>
                        <Icon className="w-10 h-10 text-white" />
                    </div>
                    <span className="text-gray-400 font-medium tracking-wide">
                        {isVideoOff ? 'Camera Off' : ''}
                    </span>
                </div>
            )}

            {/* Bottom Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            role === 'Judge' ? "bg-purple-500 text-white" : "bg-blue-500 text-white"
                        )}>
                            {role}
                        </div>
                        <span className="text-white font-semibold text-sm truncate max-w-[120px]">
                            {isLocal ? 'Me' : (participant.user_name || 'Participant')}
                        </span>
                    </div>

                    <div className="flex gap-1.5">
                        {isAudioOff && (
                            <div className="w-8 h-8 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center border border-red-500/30">
                                <MicOff className="w-4 h-4 text-red-500" />
                            </div>
                        )}
                        {isVideoOff && (
                            <div className="w-8 h-8 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center border border-red-500/30">
                                <CameraOff className="w-4 h-4 text-red-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Judge Specific Accent */}
            {role === 'Judge' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse" />
            )}
        </div>
    );
};

export default ParticipantView;
