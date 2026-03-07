import Room from '../models/Room.js';
import emailService from '../services/emailService.js';
import roleAssignmentService from '../services/roleAssignmentService.js';
import serviceClient from '../services/serviceClient.js';
import { ApiError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { createDailyRoom, getMeetingToken } from '../utils/aiServiceClient.js';

/**
 * Room Controller - Handles all room-related operations
 */



const roomController = {
    /**
     * Create a new mock trial room
     * POST /api/rooms/create
     */
    createRoom: async (req, res) => {
        const { topic, description, scheduledDate, scheduledTime, agenda, participants, requiredRoles } = req.body;
        const ownerId = req.headers['user-id'] || req.body.ownerId;

        if (!ownerId) {
            throw new ApiError(401, 'User ID is required');
        }

        // Process participants with invitedRole field
        const processedParticipants = (participants || []).map(p => ({
            email: p.email.toLowerCase(),
            invitedRole: p.role || 'Unassigned',
            status: 'Pending',
            invitedAt: new Date()
        }));

        // DATE & TIME VALIDATION
        const sessionDate = new Date(scheduledDate);
        if (isNaN(sessionDate.getTime())) {
            throw new ApiError(400, 'Invalid date format');
        }

        // Combine date and time
        const [hours, minutes] = (scheduledTime || '09:00').split(':').map(Number);
        const scheduledDateTime = new Date(sessionDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        // Validation: Cannot schedule in the past (allow 5 min buffer for network latency)
        const now = new Date();
        const bufferTime = new Date(now.getTime() - 5 * 60000); // 5 mins ago

        if (scheduledDateTime < bufferTime) {
            throw new ApiError(400, 'Cannot schedule a trial in the past. Please check the date and time.');
        }

        // Create room with initial data
        const room = new Room({
            topic,
            description,
            scheduledDate: new Date(scheduledDate),
            scheduledTime,
            agenda,
            ownerId,
            participants: processedParticipants,
            requiredRoles: requiredRoles || undefined,
            roomStatus: 'Scheduled'
        });

        await room.save();
        logger.info(`Room created: ${room._id} by user ${ownerId}`);

        // Send invitations to initial participants if any
        if (processedParticipants.length > 0) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

            for (const participant of processedParticipants) {
                const joinLink = `${frontendUrl}/mock-trial/join/${room._id}?email=${encodeURIComponent(participant.email)}`;

                try {
                    await emailService.sendTrialInvitation(
                        participant.email,
                        {
                            topic: room.topic,
                            description: room.description,
                            scheduledDate: room.scheduledDate,
                            scheduledTime: room.scheduledTime,
                            role: participant.invitedRole,
                            agenda: room.agenda
                        },
                        joinLink
                    );
                } catch (error) {
                    logger.error(`Failed to send invitation to ${participant.email}:`, error);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Room created successfully',
            data: {
                room: {
                    id: room._id,
                    topic: room.topic,
                    description: room.description,
                    scheduledDate: room.scheduledDate,
                    scheduledTime: room.scheduledTime,
                    agenda: room.agenda,
                    roomCode: room.roomCode,
                    roomStatus: room.roomStatus,
                    participantCount: room.participants.length,
                    createdAt: room.createdAt
                }
            }
        });
    },

    /**
     * Get all rooms for a user (as owner or participant)
     * GET /api/rooms/my-trials
     */
    getRoomsByUser: async (req, res) => {
        const userId = req.headers['user-id'];
        const userEmail = req.headers['user-email'];

        if (!userId) {
            throw new ApiError(401, 'User ID is required');
        }

        // Build query - find rooms where user is owner OR participant
        const query = { ownerId: userId };

        if (userEmail) {
            query.$or = [
                { ownerId: userId },
                { 'participants.email': userEmail.toLowerCase() }
            ];
            delete query.ownerId;
        }

        const rooms = await Room.find(query)
            .sort({ scheduledDate: -1, scheduledTime: -1 })
            .select('-__v')
            .lean();

        // Categorize rooms
        const categorizedRooms = {
            upcoming: [],
            rolesAssigned: [],
            live: [],
            completed: []
        };

        const now = new Date();
        // Grace period: 2 hours after scheduled time (for ongoing sessions without status update)
        const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

        rooms.forEach(room => {
            const isOwner = room.ownerId.toString() === userId;
            const participantInfo = userEmail
                ? room.participants.find(p => p.email === userEmail.toLowerCase())
                : null;

            // Calculate scheduled datetime from scheduledDate + scheduledTime
            let scheduledDateTime = null;
            if (room.scheduledDate && room.scheduledTime) {
                const [hours, minutes] = room.scheduledTime.split(':').map(Number);
                scheduledDateTime = new Date(room.scheduledDate);
                scheduledDateTime.setHours(hours, minutes, 0, 0);
            } else if (room.scheduledDate) {
                scheduledDateTime = new Date(room.scheduledDate);
            }

            // Check if session time has passed (beyond grace period)
            const isTimePassed = scheduledDateTime && (now.getTime() > scheduledDateTime.getTime() + GRACE_PERIOD_MS);
            // Check if we're within the session window (scheduled time to scheduled time + 2 hours)
            const isInSessionWindow = scheduledDateTime &&
                (now.getTime() >= scheduledDateTime.getTime()) &&
                (now.getTime() <= scheduledDateTime.getTime() + GRACE_PERIOD_MS);

            const enrichedRoom = {
                ...room,
                id: room._id,
                isOwner,
                userRole: isOwner ? 'Owner' : (participantInfo?.assignedRole || participantInfo?.invitedRole || 'Participant'),
                userStatus: isOwner ? 'Accepted' : (participantInfo?.status || 'Unknown'),
                participantCount: room.participants.length,
                acceptedCount: room.participants.filter(p => p.status === 'Accepted').length,
                isRolesLocked: room.roleAssignment?.isLocked || false,
                scheduledDateTime: scheduledDateTime?.toISOString() || null,
                isTimePassed
            };

            // Categorize based on status AND time
            if (room.roomStatus === 'Completed') {
                categorizedRooms.completed.push(enrichedRoom);
            } else if (room.roomStatus === 'Live') {
                categorizedRooms.live.push(enrichedRoom);
            } else if (isTimePassed) {
                // Time has passed beyond grace period - treat as completed/past
                enrichedRoom.roomStatus = 'Past';
                categorizedRooms.completed.push(enrichedRoom);
            } else if (room.roomStatus === 'RolesAssigned') {
                categorizedRooms.rolesAssigned.push(enrichedRoom);
            } else {
                // Scheduled or other - only show if time hasn't passed
                categorizedRooms.upcoming.push(enrichedRoom);
            }
        });

        res.json({
            success: true,
            data: {
                rooms: categorizedRooms,
                total: rooms.length
            }
        });
    },

    /**
     * Get a single room by ID
     * GET /api/rooms/:roomId
     */
    getRoomById: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId).lean();

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        const isOwner = room.ownerId.toString() === userId;

        res.json({
            success: true,
            data: {
                room: {
                    ...room,
                    id: room._id,
                    isOwner,
                    participantCount: room.participants.length,
                    acceptedCount: room.participants.filter(p => p.status === 'Accepted').length,
                    assignedCount: room.participants.filter(p => p.assignedRole !== null).length,
                    isRolesLocked: room.roleAssignment?.isLocked || false
                }
            }
        });
    },

    /**
     * Update room details
     * PUT /api/rooms/:roomId
     */
    updateRoom: async (req, res) => {
        const { roomId } = req.params;
        const { topic, description, scheduledDate, scheduledTime, agenda } = req.body;
        const userId = req.headers['user-id'];

        if (!userId) {
            throw new ApiError(401, 'User ID is required');
        }

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        // Check if user is the owner
        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can update this room');
        }

        // Cannot update if room is Live or Completed
        if (room.roomStatus === 'Live' || room.roomStatus === 'Completed') {
            throw new ApiError(400, `Cannot update a room that is ${room.roomStatus}`);
        }

        // Update fields
        if (topic) room.topic = topic;
        if (description !== undefined) room.description = description;
        if (scheduledDate) room.scheduledDate = new Date(scheduledDate);
        if (scheduledTime) room.scheduledTime = scheduledTime;
        if (agenda !== undefined) room.agenda = agenda;

        await room.save();

        logger.info(`Room ${roomId} updated by user ${userId}`);

        res.json({
            success: true,
            message: 'Room updated successfully',
            data: {
                room: {
                    id: room._id,
                    topic: room.topic,
                    description: room.description,
                    scheduledDate: room.scheduledDate,
                    scheduledTime: room.scheduledTime,
                    agenda: room.agenda,
                    roomStatus: room.roomStatus
                }
            }
        });
    },

    /**
     * Delete a room
     * DELETE /api/rooms/:roomId
     */
    deleteRoom: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        if (!userId) {
            throw new ApiError(401, 'User ID is required');
        }

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        // Check if user is the owner
        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can delete this room');
        }

        // Cannot delete if room is Live
        if (room.roomStatus === 'Live') {
            throw new ApiError(400, 'Cannot delete a room that is currently live');
        }

        await Room.findByIdAndDelete(roomId);

        logger.info(`Room ${roomId} deleted by user ${userId}`);

        res.json({
            success: true,
            message: 'Room deleted successfully'
        });
    },

    /**
     * Invite participants to a room
     * POST /api/rooms/invite/:roomId
     */
    inviteParticipants: async (req, res) => {
        const { roomId } = req.params;
        const { participants } = req.body;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        // Check if user is the owner
        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can invite participants');
        }

        // Check room status
        if (room.roomStatus === 'Completed') {
            throw new ApiError(400, 'Cannot invite participants to a completed trial');
        }

        // Check if roles are locked
        if (room.roleAssignment?.isLocked) {
            throw new ApiError(400, 'Cannot invite participants after roles are assigned. Unlock roles first.');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const invited = [];
        const alreadyExists = [];
        const failed = [];

        for (const participant of participants) {
            const email = participant.email.toLowerCase();

            // Check if already a participant
            if (room.participants.some(p => p.email === email)) {
                alreadyExists.push(email);
                continue;
            }

            // Add to participants array with invitedRole
            room.participants.push({
                email,
                invitedRole: participant.role || 'Unassigned',
                status: 'Pending',
                invitedAt: new Date()
            });

            // Send invitation email
            const joinLink = `${frontendUrl}/mock-trial/join/${room._id}?email=${encodeURIComponent(email)}`;

            try {
                await emailService.sendTrialInvitation(
                    email,
                    {
                        topic: room.topic,
                        description: room.description,
                        scheduledDate: room.scheduledDate,
                        scheduledTime: room.scheduledTime,
                        role: participant.role || 'Unassigned',
                        agenda: room.agenda
                    },
                    joinLink
                );
                invited.push(email);

                // Emit real-time notification via Socket.IO
                if (req.io) {
                    req.io.to(`user:${email}`).emit('user:invitation:received', {
                        roomId: room._id,
                        topic: room.topic,
                        description: room.description,
                        scheduledDate: room.scheduledDate,
                        scheduledTime: room.scheduledTime,
                        invitedRole: participant.role || 'Unassigned',
                        ownerName: room.ownerId || 'System', // Using ID if name not avail
                        invitedAt: new Date()
                    });
                    logger.info(`Socket notification sent to user:${email}`);
                }
            } catch (error) {
                logger.error(`Failed to send invitation to ${email}:`, error);
                failed.push(email);
            }
        }

        await room.save();
        logger.info(`Invitations sent for room ${roomId}: ${invited.length} sent, ${alreadyExists.length} existing, ${failed.length} failed`);

        res.json({
            success: true,
            message: 'Invitations processed',
            data: {
                invited,
                alreadyExists,
                failed,
                totalParticipants: room.participants.length
            }
        });
    },

    /**
     * Update room status (Scheduled -> RolesAssigned -> Live -> Completed)
     * PATCH /api/rooms/:roomId/status
     */
    updateRoomStatus: async (req, res) => {
        const { roomId } = req.params;
        const { status } = req.body;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        // Check if user is the owner
        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can update the room status');
        }

        // Validate status transition
        const validTransitions = {
            'Scheduled': ['RolesAssigned', 'Live', 'Completed'],
            'RolesAssigned': ['Live', 'Completed'],
            'Live': ['Completed'],
            'Completed': []
        };

        if (!validTransitions[room.roomStatus]?.includes(status)) {
            throw new ApiError(400, `Cannot transition from ${room.roomStatus} to ${status}`);
        }

        // Require roles to be assigned before going Live
        const previousStatus = room.roomStatus;

        // Call AI Service to create Daily room when going Live
        if (status === 'Live' && !room.dailyRoomUrl) {
            try {
                const result = await createDailyRoom(room._id.toString());
                if (result.success) {
                    room.dailyRoomUrl = result.data.url;
                    room.dailyRoomName = result.data.name;
                    logger.info(`Daily room created for room ${roomId}: ${room.dailyRoomUrl}`);
                }
            } catch (error) {
                logger.error(`Failed to create Daily room for ${roomId}:`, error);
                throw new ApiError(500, 'Could not initialize video courtroom environment');
            }
        }

        room.roomStatus = status;
        await room.save();

        logger.info(`Room ${roomId} status updated: ${previousStatus} -> ${status}`);

        // Notify participants of status change
        if (status === 'Live') {
            const acceptedParticipants = room.participants.filter(p => p.status === 'Accepted');

            for (const participant of acceptedParticipants) {
                try {
                    await emailService.sendStatusUpdate(
                        participant.email,
                        { topic: room.topic, roomCode: room.roomCode },
                        status
                    );
                } catch (error) {
                    logger.error(`Failed to send status update to ${participant.email}:`, error);
                }
            }
        }

        res.json({
            success: true,
            message: `Room status updated to ${status}`,
            data: {
                roomId: room._id,
                previousStatus,
                newStatus: status,
                updatedAt: room.updatedAt
            }
        });
    },

    /**
     * Accept invitation to a room
     * POST /api/rooms/:roomId/accept
     */
    acceptInvitation: async (req, res) => {
        const { roomId } = req.params;
        const userEmail = req.headers['user-email'] || req.body.email;
        const userId = req.headers['user-id'];

        if (!userEmail) {
            throw new ApiError(400, 'User email is required');
        }

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        const participant = room.participants.find(
            p => p.email === userEmail.toLowerCase()
        );

        if (!participant) {
            throw new ApiError(404, 'Invitation not found for this email');
        }

        if (participant.status === 'Accepted') {
            return res.json({
                success: true,
                message: 'Invitation already accepted',
                data: { roomId: room._id, status: 'Accepted' }
            });
        }

        participant.status = 'Accepted';
        // Link user ID to participant if available
        if (userId) {
            participant.userId = userId;
        }
        await room.save();

        logger.info(`Invitation accepted: ${userEmail} for room ${roomId}`);

        res.json({
            success: true,
            message: 'Invitation accepted successfully',
            data: {
                roomId: room._id,
                topic: room.topic,
                invitedRole: participant.invitedRole,
                assignedRole: participant.assignedRole,
                status: 'Accepted',
                scheduledDate: room.scheduledDate,
                scheduledTime: room.scheduledTime
            }
        });
    },

    /**
     * Decline invitation to a room
     * POST /api/rooms/:roomId/decline
     */
    declineInvitation: async (req, res) => {
        const { roomId } = req.params;
        const userEmail = req.headers['user-email'] || req.body.email;
        const userId = req.headers['user-id'];

        if (!userEmail) {
            throw new ApiError(400, 'User email is required');
        }

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        const participant = room.participants.find(
            p => p.email === userEmail.toLowerCase()
        );

        if (!participant) {
            throw new ApiError(404, 'Invitation not found for this email');
        }

        if (participant.status === 'Declined') {
            return res.json({
                success: true,
                message: 'Invitation already declined',
                data: { roomId: room._id, status: 'Declined' }
            });
        }

        participant.status = 'Declined';
        if (userId) {
            participant.userId = userId;
        }
        await room.save();

        logger.info(`Invitation declined: ${userEmail} for room ${roomId}`);

        res.json({
            success: true,
            message: 'Invitation declined successfully',
            data: {
                roomId: room._id,
                status: 'Declined'
            }
        });
    },

    /**
     * Get all pending invitations for the current user
     * GET /api/rooms/my-invitations
     */
    getMyInvitations: async (req, res) => {
        const userEmail = req.headers['user-email'];
        const userId = req.headers['user-id'];

        if (!userEmail && !userId) {
            throw new ApiError(400, 'User email or ID is required');
        }

        // Find all rooms where this user is a participant with Pending status
        const query = {
            'participants.status': 'Pending',
            roomStatus: { $nin: ['Completed', 'Cancelled'] }
        };

        if (userEmail) {
            query['participants.email'] = userEmail.toLowerCase();
        }

        const rooms = await Room.find(query)
            .sort({ scheduledDate: 1 })
            .lean();

        // Extract pending invitations for this user
        const invitations = rooms.map(room => {
            const participant = room.participants.find(
                p => p.email === userEmail?.toLowerCase() && p.status === 'Pending'
            );

            if (!participant) return null;

            return {
                roomId: room._id,
                topic: room.topic,
                description: room.description,
                scheduledDate: room.scheduledDate,
                scheduledTime: room.scheduledTime,
                invitedRole: participant.invitedRole,
                invitedAt: participant.invitedAt,
                ownerName: room.ownerName || 'Unknown',
                participantCount: room.participants.length
            };
        }).filter(Boolean);

        res.json({
            success: true,
            data: {
                invitations,
                total: invitations.length
            }
        });
    },

    /**
     * Update room details
     * PUT /api/rooms/:roomId
     */
    updateRoom: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];
        const updates = req.body;

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can update room details');
        }

        if (room.roomStatus === 'Completed') {
            throw new ApiError(400, 'Cannot update a completed trial');
        }

        // Update allowed fields
        const allowedUpdates = ['topic', 'description', 'scheduledDate', 'scheduledTime', 'agenda', 'requiredRoles'];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                room[field] = updates[field];
            }
        });

        await room.save();
        logger.info(`Room ${roomId} updated by user ${userId}`);

        res.json({
            success: true,
            message: 'Room updated successfully',
            data: { room }
        });
    },

    /**
     * Delete a room
     * DELETE /api/rooms/:roomId
     */
    deleteRoom: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can delete the room');
        }

        if (room.roomStatus === 'Live') {
            throw new ApiError(400, 'Cannot delete a live trial. Please complete or cancel it first.');
        }

        await Room.findByIdAndDelete(roomId);
        logger.info(`Room ${roomId} deleted by user ${userId}`);

        res.json({
            success: true,
            message: 'Room deleted successfully',
            data: { roomId }
        });
    },

    /**
     * Update participant role (manual override)
     * PATCH /api/rooms/:roomId/participants/:participantId/role
     */
    updateParticipantRole: async (req, res) => {
        const { roomId, participantId } = req.params;
        const { role } = req.body;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can update participant roles');
        }

        const participant = room.participants.id(participantId);

        if (!participant) {
            throw new ApiError(404, 'Participant not found');
        }

        // Update both invited and assigned role if roles are locked
        if (room.roleAssignment?.isLocked) {
            participant.assignedRole = role;
            participant.roleAssignedAt = new Date();
        } else {
            participant.invitedRole = role;
        }

        await room.save();

        res.json({
            success: true,
            message: 'Participant role updated',
            data: {
                participantId,
                email: participant.email,
                invitedRole: participant.invitedRole,
                assignedRole: participant.assignedRole
            }
        });
    },


    assignRoles: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];
        const userEmail = req.headers['user-email'];
        const { force = false } = req.body;

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        // Verify ownership
        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can assign roles');
        }

        // Check if already locked
        if (room.roleAssignment?.isLocked && !force) {
            throw new ApiError(400, 'Roles are already assigned and locked. Use force=true to reassign.');
        }

        // Check if room is in valid state
        if (room.roomStatus === 'Live' || room.roomStatus === 'Completed') {
            throw new ApiError(400, `Cannot assign roles for a ${room.roomStatus.toLowerCase()} trial`);
        }

        // Check minimum participants
        const acceptedCount = room.participants.filter(p => p.status === 'Accepted').length;
        if (acceptedCount < 3) {
            throw new ApiError(400, `Need at least 3 accepted participants. Currently have ${acceptedCount}.`);
        }

        // Run the Fair Role Rotation Algorithm with owner info and Socket.IO
        const result = await roleAssignmentService.assignRoles(room, {
            ownerEmail: userEmail,
            io: req.io
        });

        // Update user role history in user-service
        for (const assignment of result.assignments) {
            if (assignment.userId) {
                await serviceClient.updateUserRoleHistory(assignment.userId, assignment.role);
            }
        }

        // Build role map for response
        const roleMap = {};
        result.room.participants.forEach(p => {
            if (p.assignedRole) {
                roleMap[p.email] = {
                    participantId: p._id,
                    userId: p.userId,
                    role: p.assignedRole,
                    assignedAt: p.roleAssignedAt
                };
            }
        });

        res.json({
            success: true,
            message: 'Roles assigned successfully using Fair Rotation Algorithm',
            data: {
                roomId: room._id,
                roomCode: room.roomCode,
                roomStatus: result.room.roomStatus,
                algorithmVersion: result.algorithmVersion,
                isLocked: true,
                duration: `${result.duration}ms`,
                roleMap,
                assignments: result.assignments.map(a => ({
                    email: a.email,
                    role: a.role,
                    priorityScore: a.priorityScore,
                    reason: a.reason
                })),
                summary: {
                    totalParticipants: room.participants.length,
                    acceptedParticipants: acceptedCount,
                    rolesAssigned: result.assignments.length
                }
            }
        });
    },

    /**
     * Preview role assignments without locking
     * GET /api/rooms/:roomId/preview-roles
     * 
     * Shows what the algorithm would assign without saving
     */
    previewRoles: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can preview role assignments');
        }

        const acceptedCount = room.participants.filter(p => p.status === 'Accepted').length;
        if (acceptedCount < 3) {
            throw new ApiError(400, `Need at least 3 accepted participants. Currently have ${acceptedCount}.`);
        }

        // Create a clone of the room for preview (won't be saved)
        const roomClone = new Room(room.toObject());

        const result = await roleAssignmentService.assignRoles(roomClone, {
            skipNotifications: true
        });

        res.json({
            success: true,
            message: 'Preview of role assignments (not saved)',
            data: {
                roomId: room._id,
                isPreview: true,
                algorithmVersion: result.algorithmVersion,
                assignments: result.assignments.map(a => ({
                    email: a.email,
                    role: a.role,
                    priorityScore: a.priorityScore,
                    reason: a.reason,
                    scoreBreakdown: a.scoreBreakdown
                }))
            }
        });
    },

    /**
     * Unlock roles for reassignment
     * PATCH /api/rooms/:roomId/unlock-roles
     */
    unlockRoles: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId);

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can unlock roles');
        }

        if (room.roomStatus === 'Completed') {
            throw new ApiError(400, 'Cannot unlock roles for a completed trial');
        }

        // Unlock and clear assigned roles
        room.roleAssignment.isLocked = false;
        room.roleAssignment.lockedAt = null;
        room.participants.forEach(p => {
            p.assignedRole = null;
            p.roleAssignedAt = null;
            p.rolePriorityScore = null;
        });
        room.roomStatus = 'Scheduled';

        await room.save();
        logger.info(`Roles unlocked for room ${roomId} by user ${userId}`);

        res.json({
            success: true,
            message: 'Roles unlocked. You can now reassign roles.',
            data: {
                roomId: room._id,
                roomStatus: room.roomStatus,
                isLocked: false
            }
        });
    },

    /**
     * Get role assignment history/log for a room
     * GET /api/rooms/:roomId/role-history
     */
    getRoleHistory: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        const room = await Room.findById(roomId)
            .select('roleAssignment participants topic roomCode')
            .lean();

        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        res.json({
            success: true,
            data: {
                roomId: room._id,
                topic: room.topic,
                roomCode: room.roomCode,
                isLocked: room.roleAssignment?.isLocked || false,
                lockedAt: room.roleAssignment?.lockedAt,
                algorithmVersion: room.roleAssignment?.algorithmVersion,
                assignmentLog: room.roleAssignment?.assignmentLog || [],
                currentAssignments: room.participants
                    .filter(p => p.assignedRole)
                    .map(p => ({
                        email: p.email,
                        assignedRole: p.assignedRole,
                        assignedAt: p.roleAssignedAt,
                        priorityScore: p.rolePriorityScore
                    }))
            }
        });
    },



    /**
     * Get video meeting token for a room (Daily.co)
     * Checks for persisted room first, provisions if missing.
     * GET /api/rooms/:roomId/token
     */
    getVideoToken: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];
        const userEmail = req.headers['user-email'];

        const room = await Room.findById(roomId);
        if (!room) {
            throw new ApiError(404, 'Trial room not found');
        }

        // PERSISTENCE: Check if URL exists, create once if not (Single Source of Truth)
        if (!room.dailyRoomUrl || !room.dailyRoomName) {
            try {
                logger.info(`[Video] Provisioning Daily room for Trial: ${roomId}`);
                const result = await createDailyRoom(room._id.toString());
                if (result.success) {
                    room.dailyRoomUrl = result.data.url;
                    room.dailyRoomName = result.data.name;
                    await room.save();
                }
            } catch (error) {
                logger.error(`[Video] AI-Service Room Creation Failed for trial ${roomId}:`, error.message);
                throw new ApiError(500, `Courtroom initialization failed: ${error.message}`);
            }
        }

        // Verify user is part of the trial
        const isOwner = room.ownerId.toString() === userId;
        const participant = room.participants.find(p =>
            p.email === userEmail?.toLowerCase() ||
            p.userId?.toString() === userId
        );

        if (!isOwner && !participant) {
            throw new ApiError(403, 'Unauthorized: You are not a participant of this courtroom');
        }

        // Determine role for Daily metadata
        // If owner, role is 'Owner' (which ai-service maps to Defendant/Creator)
        const role = isOwner ? 'Owner' : (participant?.assignedRole || 'Participant');

        try {
            // Requesting unique token for this specific user
            const result = await getMeetingToken(room.dailyRoomName, role, userId);

            res.json({
                success: true,
                data: {
                    token: result.data.token,
                    roomUrl: room.dailyRoomUrl,
                    roomName: room.dailyRoomName
                }
            });
        } catch (error) {
            logger.error(`[Video] AI-Service Token Request Failed for user ${userId}:`, error.message);
            throw new ApiError(500, `Video gateway error: ${error.message}`);
        }
    },

    /**
     * Complete a trial session (Owner only)
     * PATCH /api/rooms/:roomId/complete
     */
    completeSession: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id']; // From JWT via API Gateway

        if (!userId) {
            throw new ApiError(401, 'Authentication required');
        }

        // Fetch the trial/room document
        const room = await Room.findById(roomId);
        if (!room) {
            throw new ApiError(404, 'Trial room not found');
        }

        // AUTHORIZATION CHECK: Only the room owner can complete the session
        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the room owner can complete this session');
        }

        // Check if already completed
        if (room.roomStatus === 'Completed') {
            return res.json({
                success: true,
                message: 'Session already completed',
                data: {
                    roomId: room._id,
                    status: room.roomStatus,
                    completedAt: room.completedAt
                }
            });
        }

        // STATUS UPDATE: Mark trial as completed
        room.roomStatus = 'Completed';
        room.completedAt = new Date();
        await room.save();

        logger.info({
            roomId,
            ownerId: userId,
            completedAt: room.completedAt
        }, 'Trial session completed by owner');

        // DAILY.CO CLEANUP: Delete room to release hardware resources
        if (room.dailyRoomName) {
            try {
                const { deleteDailyRoom } = await import('../utils/aiServiceClient.js');
                await deleteDailyRoom(room.dailyRoomName);
                logger.info({ dailyRoom: room.dailyRoomName }, 'Daily.co room deleted successfully');
            } catch (dailyErr) {
                logger.warn({
                    dailyRoom: room.dailyRoomName,
                    error: dailyErr.message
                }, 'Failed to delete Daily.co room');
                // Non-critical - continue with completion
            }
        }

        // RAG TRIGGER: Initiate transcript parsing and keyword extraction
        let learningMaterials = {
            flashcards: [],
            quizzes: [],
            summary: {
                title: 'No Learning Materials Generated',
                keyTopics: [],
                recommendations: []
            }
        };

        try {
            // Import the AI service client
            const aiServiceClient = (await import('../utils/aiServiceClient.js')).default;

            // Trigger transcript parsing for RAG-driven learning materials
            const ragResponse = await aiServiceClient.post('/api/ai/generate-learning', {
                sessionId: roomId,
                topic: room.topic
            });

            if (ragResponse.data?.success && ragResponse.data?.data) {
                learningMaterials = ragResponse.data.data;
                logger.info({
                    roomId
                }, 'RAG pipeline dynamically generated learning materials from transcript');
            }

        } catch (ragErr) {
            logger.warn({
                roomId,
                error: ragErr.message
            }, 'RAG trigger failed - using mock learning materials');
            // Non-critical - use mock materials
        }

        // GLOBAL BROADCAST: Emit completion event to all participants
        const io = req.io;
        if (io) {
            // 1. Emit to the room channel (standard broadcast)
            io.to(`room:${roomId}`).emit('TRIAL_COMPLETED', {
                trialId: roomId,
                completedBy: userId,
                completedAt: room.completedAt,
                studyMaterials: learningMaterials
            });

            io.to(`room:${roomId}`).emit('SHOW_LEARNING_POPUP', {
                roomId,
                trialTopic: room.topic,
                learningMaterials,
                timestamp: new Date()
            });

            io.to(`room:${roomId}`).emit('room:completed', {
                roomId,
                completedBy: userId,
                completedAt: room.completedAt
            });

            // 2. INDIVIDUAL BROADCAST: Emit to each participant's user channel
            // This ensures they catch the popup even if they are on the dashboard
            const participantUserIds = room.participants
                .filter(p => p.userId)
                .map(p => p.userId.toString());

            // Include owner
            if (!participantUserIds.includes(room.ownerId.toString())) {
                participantUserIds.push(room.ownerId.toString());
            }

            participantUserIds.forEach(pUserId => {
                logger.debug({ targetUserId: pUserId }, 'Emitting completion result to user channel');
                io.to(`user:${pUserId}`).emit('TRIAL_COMPLETED', {
                    trialId: roomId,
                    roomId,
                    studyMaterials: learningMaterials
                });
                io.to(`user:${pUserId}`).emit('SHOW_LEARNING_POPUP', {
                    roomId,
                    trialTopic: room.topic,
                    learningMaterials,
                    timestamp: new Date()
                });
            });

            logger.info({
                roomId,
                participantCount: room.participants.length,
                userChannelsNotified: participantUserIds.length
            }, 'Completion events broadcast to all channels');
        } else {
            logger.warn({ roomId }, 'Socket.io not available - participants not notified');
        }

        // Email notifications for all participants
        try {
            await emailService.sendBulkStatusNotifications({
                roomId: room._id,
                topic: room.topic,
                newStatus: 'Completed',
                emails: room.participants.map(p => p.email),
                additionalData: {
                    completedAt: room.completedAt,
                    message: 'The mock trial session has been completed. Your learning materials are now available.'
                }
            });
        } catch (emailErr) {
            logger.warn({ error: emailErr.message }, 'Failed to send completion emails');
            // Non-critical - continue
        }

        // Return success response
        res.json({
            success: true,
            message: 'Trial session completed successfully',
            data: {
                roomId: room._id,
                status: room.roomStatus,
                completedAt: room.completedAt,
                learningMaterials,
                participantsNotified: !!io,
                dailyRoomClosed: !!room.dailyRoomName
            }
        });
    },
};


/**
 * Trigger Learning Material Generation (Owner Only)
 * POST /api/rooms/:roomId/trigger-learning
 * 
 * Manually triggers the learning popup for all participants during an active trial.
 * Currently uses mock Sri Lankan legal data - will be replaced with RAG-generated content.
 */
roomController.triggerLearning = async (req, res) => {
    const { roomId } = req.params;
    const userId = req.headers['user-id'];
    const io = req.app.get('io');

    try {
        logger.info({ roomId, userId }, '[triggerLearning] Learning trigger requested');

        // 1. AUTHORIZATION: Verify the requester is the room owner
        const room = await Room.findById(roomId);
        if (!room) {
            throw new ApiError(404, 'Room not found');
        }

        if (room.ownerId.toString() !== userId) {
            throw new ApiError(403, 'Only the session owner can trigger learning materials');
        }

        // 2. Fetch RAG DATA PAYLOAD: Generate dynamic learning materials from the transcript using the AI service 
        let learningMaterials = {
            flashcards: [],
            quizzes: [],
            summary: {
                title: 'No Learning Materials Generated',
                keyTopics: [],
                recommendations: []
            }
        };

        const { sendDailyAppMessage } = await import('../utils/aiServiceClient.js');

        // BROADCAST LOADING STATE: Tell everyone the AI is thinking
        if (room.dailyRoomName) {
            await sendDailyAppMessage(room.dailyRoomName, 'LOADING_LEARNING', {
                message: 'Senior Sri Lankan Law Professor is generating study materials...',
                ownerId: userId
            });
        }

        try {
            const aiServiceClient = (await import('../utils/aiServiceClient.js')).default;
            const ragResponse = await aiServiceClient.post('/api/ai/generate-learning', {
                sessionId: roomId,
                topic: room.topic
            });

            if (ragResponse.data?.success && ragResponse.data?.data) {
                learningMaterials = ragResponse.data.data;
                // Make sure it has roomId and generatedAt
                learningMaterials.roomId = room._id;
                learningMaterials.trialTopic = room.topic;
                learningMaterials.generatedAt = new Date().toISOString();
                logger.info({ roomId }, 'RAG pipeline successfully generated learning materials for triggerLearning');
            }
        } catch (ragErr) {
            logger.warn({ roomId, error: ragErr.message }, 'RAG generation failed - using mock learning materials for triggerLearning');
            learningMaterials.roomId = room._id;
            learningMaterials.trialTopic = room.topic;
            learningMaterials.generatedAt = new Date().toISOString();
        }

        // 3. BROADCAST: Send to all participants in the room via Daily.co App Message
        if (room.dailyRoomName) {
            await sendDailyAppMessage(room.dailyRoomName, 'STUDY_MATERIAL_READY', {
                learningMaterials,
                roomId: room._id,
                trialTopic: room.topic,
                triggeredBy: userId,
                timestamp: new Date().toISOString()
            });
            logger.info({ roomId, dailyRoom: room.dailyRoomName }, '[triggerLearning] Learning materials broadcast via Daily.co App Message');
        }

        // Fallback or secondary broadcast via standard WebSockets
        if (io) {
            // Broadcast to room channel
            io.to(`room:${roomId}`).emit('SHOW_LEARNING_POPUP', {
                learningMaterials,
                roomId: room._id,
                trialTopic: room.topic,
                triggeredBy: userId,
                timestamp: new Date().toISOString()
            });

            // Also broadcast to each participant's user channel for global reach
            if (room.participants && room.participants.length > 0) {
                for (const participant of room.participants) {
                    const pUserId = participant.userId?.toString();
                    if (pUserId) {
                        io.to(`user:${pUserId}`).emit('SHOW_LEARNING_POPUP', {
                            learningMaterials,
                            roomId: room._id,
                            trialTopic: room.topic,
                            triggeredBy: userId,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }

            logger.info({ roomId, participantCount: room.participants.length }, '[triggerLearning] Learning materials broadcast to all participants');
        }

        res.status(200).json({
            success: true,
            message: 'Learning materials generated and sent to all participants',
            data: {
                flashcardsCount: learningMaterials.flashcards.length,
                quizzesCount: learningMaterials.quizzes.length,
                participantsNotified: room.participants.length
            }
        });

    } catch (error) {
        logger.error({ err: error, roomId }, '[triggerLearning] Failed to trigger learning');
        throw error;
    }
};

export default roomController;
