import { Router } from 'express';
import Room from '../models/Room.js';
import logger from '../utils/logger.js';

const router = Router();

// Grace period: 2 hours after scheduled time
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

/**
 * Helper: Calculate full scheduled datetime from date + time fields
 */
function getScheduledDateTime(room) {
    if (!room.scheduledDate) return null;

    let scheduledDateTime = new Date(room.scheduledDate);

    if (room.scheduledTime) {
        const [hours, minutes] = room.scheduledTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
    }

    return scheduledDateTime;
}

/**
 * @route   GET /sessions/upcoming
 * @desc    Get upcoming sessions for the current user (future, ongoing, or within grace period)
 * @access  Private
 */
router.get('/upcoming', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        const userEmail = req.headers['user-email']?.toLowerCase();

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'Authentication required' }
            });
        }

        const limit = parseInt(req.query.limit) || 6;
        const now = new Date();

        // Find all rooms for this user
        const rooms = await Room.find({
            $or: [
                { ownerId: userId },
                {
                    'participants.email': userEmail,
                    'participants.status': 'Accepted'
                }
            ]
        })
            .sort({ scheduledDate: 1, scheduledTime: 1 })
            .lean();

        // Filter to only upcoming sessions (time not passed or status is Live)
        const upcomingSessions = rooms.filter(room => {
            // Always include Live sessions
            if (room.roomStatus === 'Live') return true;

            // Exclude completed sessions
            if (room.roomStatus === 'Completed') return false;

            // Check if scheduled time has passed
            const scheduledDateTime = getScheduledDateTime(room);
            if (!scheduledDateTime) return true; // Include if no date (shouldn't happen)

            // Include if within grace period (scheduled time to scheduled time + 2 hours)
            const endOfGracePeriod = scheduledDateTime.getTime() + GRACE_PERIOD_MS;
            return now.getTime() <= endOfGracePeriod;
        }).slice(0, limit);

        // Format response
        const formattedSessions = upcomingSessions.map(session => {
            const scheduledDateTime = getScheduledDateTime(session);
            return {
                _id: session._id,
                title: session.topic,
                caseTitle: session.topic,
                caseType: session.description || 'mock-trial',
                scheduledAt: scheduledDateTime?.toISOString(),
                scheduledDate: session.scheduledDate,
                scheduledTime: session.scheduledTime,
                durationMinutes: 60, // Default
                status: session.roomStatus,
                participantCount: session.participants?.filter(p => p.status === 'Accepted').length || 0,
                isOwner: session.ownerId?.toString() === userId
            };
        });

        res.json({
            success: true,
            data: {
                sessions: formattedSessions,
                serverTime: now.toISOString()
            }
        });
    } catch (error) {
        logger.error('Error fetching upcoming sessions:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch upcoming sessions' }
        });
    }
});

/**
 * @route   GET /sessions/recent
 * @desc    Get past sessions (completed or scheduled time has passed beyond grace period)
 * @access  Private
 */
router.get('/recent', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        const userEmail = req.headers['user-email']?.toLowerCase();

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'Authentication required' }
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const now = new Date();

        // Find all rooms for this user
        const allRooms = await Room.find({
            $or: [
                { ownerId: userId },
                {
                    'participants.email': userEmail,
                    'participants.status': 'Accepted'
                }
            ]
        })
            .sort({ scheduledDate: -1, scheduledTime: -1 })
            .lean();

        // Filter to only past sessions (time passed beyond grace period OR status is Completed)
        const pastSessions = allRooms.filter(room => {
            // Always include Completed sessions
            if (room.roomStatus === 'Completed') return true;

            // Exclude Live sessions (they're still ongoing)
            if (room.roomStatus === 'Live') return false;

            // Check if scheduled time has passed beyond grace period
            const scheduledDateTime = getScheduledDateTime(room);
            if (!scheduledDateTime) return false;

            const endOfGracePeriod = scheduledDateTime.getTime() + GRACE_PERIOD_MS;
            return now.getTime() > endOfGracePeriod;
        });

        const total = pastSessions.length;
        const paginatedSessions = pastSessions.slice(skip, skip + limit);

        // Format response
        const formattedSessions = paginatedSessions.map(session => {
            const scheduledDateTime = getScheduledDateTime(session);
            const estimatedEndTime = scheduledDateTime
                ? new Date(scheduledDateTime.getTime() + 60 * 60 * 1000) // Assume 1 hour duration
                : null;

            // Determine display status
            let displayStatus = session.roomStatus;
            if (session.roomStatus !== 'Completed' && scheduledDateTime) {
                const endOfGracePeriod = scheduledDateTime.getTime() + GRACE_PERIOD_MS;
                if (now.getTime() > endOfGracePeriod) {
                    displayStatus = 'ended'; // Session ended but wasn't marked completed
                }
            } else if (session.roomStatus === 'Completed') {
                displayStatus = 'completed';
            }

            return {
                _id: session._id,
                title: session.topic,
                caseTitle: session.topic,
                caseType: session.description || 'mock-trial',
                scheduledAt: scheduledDateTime?.toISOString(),
                endsAt: estimatedEndTime?.toISOString(),
                durationMinutes: 60,
                timezone: 'Asia/Colombo',
                status: displayStatus,
                participantCount: session.participants?.filter(p => p.status === 'Accepted').length || 0,
                isOwner: session.ownerId?.toString() === userId
            };
        });

        res.json({
            success: true,
            data: {
                sessions: formattedSessions,
                serverTime: now.toISOString()
            },
            meta: {
                pagination: {
                    page,
                    pages: Math.ceil(total / limit),
                    total,
                    limit
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching recent sessions:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch recent sessions' }
        });
    }
});

export default router;
