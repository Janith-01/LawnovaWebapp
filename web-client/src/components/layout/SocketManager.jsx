import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import {
    setSocketConnected,
    addInvitation,
} from '@/store/slices/notificationSlice';
import { toast } from 'sonner';

const SocketManager = () => {
    const dispatch = useDispatch();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const socketUrl = import.meta.env.VITE_API_GATEWAY_URL || window.location.origin;
        // Get token from storage - typically in localStorage or cookies
        // We need it for the middleware we just added!
        // But SocketManager runs globally.
        // Assuming 'api' helper handles auth, but here we construct raw socket.
        // We should try to get token.
        const token = localStorage.getItem('accessToken'); // Adjust key if needed

        const socket = io(socketUrl, {
            transports: ['websocket'], // Force pure websockets
            path: '/socket.io',
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            dispatch(setSocketConnected(true));

            // Join user channel for real-time updates
            // Ensure we use the same structure as backend expects
            socket.emit('join:user', {
                userId: user.id || user._id,
                email: user.email
            });
        });

        socket.on('disconnect', () => {
            dispatch(setSocketConnected(false));
        });

        socket.on('user:invitation:received', (data) => {
            console.log('Real-time invitation received:', data);
            dispatch(addInvitation(data));
            toast.info(`You have been invited to join "${data.topic}"`);
        });

        return () => {
            socket.disconnect();
        };
    }, [user, dispatch]);

    return null;
};

export default SocketManager;

