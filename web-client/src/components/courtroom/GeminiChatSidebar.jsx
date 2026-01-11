import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Send, Loader2, Sparkles,
    User, Bot, Trash2, ChevronDown, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import mockTrialService from '@/services/mockTrialService';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const GeminiChatSidebar = ({ roomId, isOpen, onClose }) => {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    // Scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Load chat history on mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                setIsLoadingHistory(true);
                const response = await mockTrialService.getChatHistory(roomId);
                // Safe access with optional chaining
                const history = response?.data?.messages || [];
                setMessages(history);
            } catch (error) {
                console.error('Failed to load chat history:', error);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        if (roomId && isOpen) {
            loadHistory();
        }
    }, [roomId, isOpen]);

    // Socket.io connection for real-time updates
    useEffect(() => {
        if (!roomId || !token) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('[GeminiChat] Socket connected');
            socket.emit('join:room', { roomId });
        });

        // Listen for chat messages
        socket.on('chat:message', (data) => {
            if (data?.roomId === roomId) {
                setMessages(prev => [...prev, {
                    sender: data.sender,
                    userName: data.userName,
                    message: data.message,
                    timestamp: data.timestamp
                }]);
                setIsLoading(false);
            }
        });

        socket.on('chat:cleared', (data) => {
            if (data?.roomId === roomId) {
                setMessages([]);
            }
        });

        socketRef.current = socket;

        return () => {
            socket.emit('leave:room', { roomId });
            socket.disconnect();
        };
    }, [roomId, token]);

    // Send message
    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const question = inputValue.trim();
        setInputValue('');
        setIsLoading(true);

        // Optimistically add user message
        const userMsg = {
            sender: 'User',
            userName: user?.fullName || user?.email || 'You',
            message: question,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            await mockTrialService.sendChatMessage(roomId, question);
            // Response will come via socket
        } catch (error) {
            console.error('Failed to send message:', error);
            setIsLoading(false);
            // Add error message
            setMessages(prev => [...prev, {
                sender: 'AI',
                userName: 'AI Legal Assistant',
                message: 'I apologize, there was an error processing your request. Please try again.',
                timestamp: new Date().toISOString()
            }]);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="h-full w-full bg-gray-950 border-r border-gray-800 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-purple-900/20 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">AI Legal Assistant</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Powered by Gemini</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingHistory ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                        <p className="text-gray-500 text-sm">Loading conversation...</p>
                    </div>
                ) : messages?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-white font-semibold">Ask the AI Legal Assistant</h3>
                        <p className="text-gray-500 text-sm">
                            Get help with court procedures, legal terminology, and Sri Lankan law concepts.
                        </p>
                        <div className="grid gap-2 w-full mt-4">
                            {['What is cross-examination?', 'Explain burden of proof', 'Matrimonial Rights Act basics'].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => setInputValue(q)}
                                    className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-left text-sm text-gray-300 hover:bg-gray-800 hover:border-purple-500/30 transition-all"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages?.map((msg, idx) => (
                            <ChatMessage key={idx} message={msg} />
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-none p-4">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                        <span className="text-purple-400 text-sm font-medium animate-pulse">
                                            Gemini is thinking...
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask about legal concepts..."
                        disabled={isLoading}
                        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                            inputValue.trim() && !isLoading
                                ? "bg-purple-600 hover:bg-purple-700 text-white"
                                : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <p className="mt-2 text-[10px] text-gray-600 text-center">
                    AI responses are for educational purposes only
                </p>
            </div>
        </div>
    );
};

// Individual Chat Message Component
const ChatMessage = ({ message }) => {
    const isAI = message?.sender === 'AI';

    return (
        <div className={cn("flex items-start gap-3", !isAI && "flex-row-reverse")}>
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                isAI
                    ? "bg-gradient-to-br from-purple-500 to-pink-500"
                    : "bg-blue-600"
            )}>
                {isAI ? (
                    <Bot className="w-4 h-4 text-white" />
                ) : (
                    <User className="w-4 h-4 text-white" />
                )}
            </div>
            <div className={cn(
                "flex-1 max-w-[280px] rounded-2xl p-4",
                isAI
                    ? "bg-gray-900 border border-gray-800 rounded-tl-none"
                    : "bg-blue-600 rounded-tr-none"
            )}>
                <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">
                    {message?.userName || (isAI ? 'AI Assistant' : 'You')}
                </p>
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                    {message?.message || ''}
                </p>
                <p className="text-[9px] text-gray-600 mt-2">
                    {message?.timestamp
                        ? new Date(message.timestamp).toLocaleTimeString()
                        : ''
                    }
                </p>
            </div>
        </div>
    );
};

export default GeminiChatSidebar;
