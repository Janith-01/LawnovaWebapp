import videoService from '../services/videoService.js';

/**
 * Controller to create a Daily room
 * POST /api/video/rooms
 */
export const createRoom = async (req, res) => {
    try {
        const { trialId } = req.body;
        if (!trialId) {
            return res.status(400).json({ success: false, message: 'Trial ID is required' });
        }

        const roomInfo = await videoService.createDailyRoom(trialId);
        res.status(201).json({
            success: true,
            data: {
                name: roomInfo.name,
                url: roomInfo.url,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Controller to generate a meeting token
 * GET /api/video/token/:roomName
 */
export const getToken = async (req, res) => {
    console.log(`[VideoController] Inbound token request for room: ${req.params.roomName}`);
    try {
        const { roomName } = req.params;
        const userId = req.headers['user-id'];
        const role = req.query.role || req.headers['user-role'] || 'Participant';

        if (!roomName) {
            return res.status(400).json({ success: false, message: 'Room name is required' });
        }

        const token = await videoService.generateMeetingToken(roomName, {
            userId,
            role
        });

        res.json({
            success: true,
            data: { token },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Controller to delete/close a Daily room
 * DELETE /api/video/rooms/:roomName
 */
export const deleteRoom = async (req, res) => {
    try {
        const { roomName } = req.params;

        if (!roomName) {
            return res.status(400).json({ success: false, message: 'Room name is required' });
        }

        const result = await videoService.deleteDailyRoom(roomName);
        res.json({
            success: true,
            message: 'Room closed successfully',
            data: result
        });
    } catch (error) {
        console.error('[VideoController] Delete room error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Controller to send an app message
 * POST /api/video/rooms/:roomName/message
 */
export const sendMessage = async (req, res) => {
    try {
        const { roomName } = req.params;
        const messageBody = req.body; // { type, data }

        if (!roomName) {
            return res.status(400).json({ success: false, message: 'Room name is required' });
        }

        const result = await videoService.sendAppMessage(roomName, messageBody);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[VideoController] Send app message error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default {
    createRoom,
    getToken,
    deleteRoom,
    sendMessage,

};
