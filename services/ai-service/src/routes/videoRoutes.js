import express from 'express';
import videoController from '../controllers/videoController.js';

const router = express.Router();

// POST /api/video/rooms - Create a new room
router.post('/rooms', videoController.createRoom);

// GET /api/video/token/:roomName - Get meeting token
router.get('/token/:roomName', videoController.getToken);

// DELETE /api/video/rooms/:roomName - Close/delete a room
router.delete('/rooms/:roomName', videoController.deleteRoom);

export default router;
