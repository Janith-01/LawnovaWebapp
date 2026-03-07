import { Router } from 'express';
import roomController from '../controllers/roomController.js';
import chatController from '../controllers/chatController.js';
import { broadcastStudySuite } from '../controllers/aiController.js';
import { validate, roomSchemas } from '../middleware/validate.js';

const router = Router();

// ============================================
// ROOM CRUD ENDPOINTS
// ============================================

/**
 * @route   POST /api/rooms/create
 * @desc    Create a new mock trial room
 * @access  Private (Room Owners)
 */
router.post(
    '/create',
    validate(roomSchemas.createRoom),
    roomController.createRoom
);

/**
 * @route   GET /api/rooms/my-trials
 * @desc    Get all rooms for the authenticated user (owner or participant)
 * @access  Private
 */
router.get(
    '/my-trials',
    roomController.getRoomsByUser
);

/**
 * @route   GET /api/rooms/my-invitations
 * @desc    Get all pending invitations for the current user
 * @access  Private
 */
router.get(
    '/my-invitations',
    roomController.getMyInvitations
);

/**
 * @route   GET /api/rooms/:roomId
 * @desc    Get a single room by ID
 * @access  Private
 */
router.get(
    '/:roomId',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.getRoomById
);

/**
 * @route   GET /api/rooms/:roomId/token
 * @desc    Get video meeting token for a room
 * @access  Private
 */
router.get(
    '/:roomId/token',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.getVideoToken
);

/**
 * @route   PUT /api/rooms/:roomId
 * @desc    Update room details
 * @access  Private (Owner only)
 */
router.put(
    '/:roomId',
    validate(roomSchemas.roomIdParam, 'params'),
    validate(roomSchemas.updateRoom),
    roomController.updateRoom
);

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete a room
 * @access  Private (Owner only)
 */
router.delete(
    '/:roomId',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.deleteRoom
);

// ============================================
// INVITATION ENDPOINTS
// ============================================

/**
 * @route   POST /api/rooms/invite/:roomId
 * @desc    Invite participants to a room
 * @access  Private (Owner only)
 */
router.post(
    '/invite/:roomId',
    validate(roomSchemas.roomIdParam, 'params'),
    validate(roomSchemas.inviteParticipants),
    roomController.inviteParticipants
);

/**
 * @route   POST /api/rooms/:roomId/accept
 * @desc    Accept invitation to a room
 * @access  Private (Invited participant)
 */
router.post(
    '/:roomId/accept',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.acceptInvitation
);

/**
 * @route   POST /api/rooms/:roomId/decline
 * @desc    Decline invitation to a room
 * @access  Private (Invited participant)
 */
router.post(
    '/:roomId/decline',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.declineInvitation
);

// ============================================
// STATUS & PARTICIPANT MANAGEMENT
// ============================================

/**
 * @route   PATCH /api/rooms/:roomId/status
 * @desc    Update room status (Scheduled -> RolesAssigned -> Live -> Completed)
 * @access  Private (Owner only)
 */
router.patch(
    '/:roomId/status',
    validate(roomSchemas.roomIdParam, 'params'),
    validate(roomSchemas.updateStatus),
    roomController.updateRoomStatus
);

/**
 * @route   PATCH /api/rooms/:roomId/participants/:participantId/role
 * @desc    Update participant role (manual override)
 * @access  Private (Owner only)
 */
router.patch(
    '/:roomId/participants/:participantId/role',
    roomController.updateParticipantRole
);

// ============================================
// FAIR ROLE ROTATION ENGINE ENDPOINTS
// ============================================

/**
 * @route   PATCH /api/rooms/:roomId/assign-roles
 * @desc    Trigger Fair Role Rotation Algorithm to assign roles
 *          Uses Weighted Scarcity Algorithm with performance-based matching
 *          Locks the room for trial start
 * @access  Private (Owner only)
 * @body    { force: boolean } - Optional, force reassignment if already locked
 */
router.patch(
    '/:roomId/assign-roles',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.assignRoles
);

/**
 * @route   GET /api/rooms/:roomId/preview-roles
 * @desc    Preview role assignments without saving/locking
 *          Useful for owners to see algorithm output before committing
 * @access  Private (Owner only)
 */
router.get(
    '/:roomId/preview-roles',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.previewRoles
);

/**
 * @route   PATCH /api/rooms/:roomId/unlock-roles
 * @desc    Unlock roles for reassignment (clears current assignments)
 * @access  Private (Owner only)
 */
router.patch(
    '/:roomId/unlock-roles',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.unlockRoles
);

/**
 * @route   GET /api/rooms/:roomId/role-history
 * @desc    Get role assignment history and current assignments for a room
 * @access  Private
 */
router.get(
    '/:roomId/role-history',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.getRoleHistory
);

/**
 * @route   GET /api/rooms/:roomId/token
 * @desc    Get video meeting token for a room
 * @access  Private (Owner/Participant)
 */
router.get(
    '/:roomId/token',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.getVideoToken
);

// ============================================
// CHAT ENDPOINTS (AI Legal Assistant)
// ============================================

/**
 * @route   POST /api/rooms/:roomId/chat
 * @desc    Send a message to the AI Legal Assistant
 * @access  Private (Participants)
 */
router.post(
    '/:roomId/chat',
    validate(roomSchemas.roomIdParam, 'params'),
    chatController.sendMessage
);

router.post(
    '/:roomId/chat/save-ai',
    validate(roomSchemas.roomIdParam, 'params'),
    chatController.saveAiMessage
);
router.get(
    '/:roomId/chat',
    validate(roomSchemas.roomIdParam, 'params'),
    chatController.getChatHistory
);

/**
 * @route   DELETE /api/rooms/:roomId/chat
 * @desc    Clear chat history (owner only)
 * @access  Private (Owner)
 */
router.delete(
    '/:roomId/chat',
    validate(roomSchemas.roomIdParam, 'params'),
    chatController.clearChatHistory
);

// ============================================
// SESSION COMPLETION ENDPOINTS
// ============================================

/**
 * @route   PATCH /api/rooms/:roomId/complete
 * @desc    Complete a trial session (Owner only)
 * @access  Private (Owner)
 */
router.patch(
    '/:roomId/complete',
    validate(roomSchemas.roomIdParam, 'params'),
    roomController.completeSession
);

/**
 * @route   POST /api/rooms/:roomId/trigger-learning
 * @desc    Trigger AI learning material generation (Owner only)
 * @access  Private (Owner)
 */
router.post(
    '/:roomId/trigger-learning',
    validate(roomSchemas.roomIdParam, 'params'),
    broadcastStudySuite
);

export default router;
