import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the service directory
dotenv.config({ path: path.join(__dirname, 'services', 'mocktrial-service', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const ROOM_ID = '69ad0ac8c50e1804f549136d';

async function checkRoom() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected!');

        // Define a minimal schema since we don't want to import the model and deal with its dependencies
        const RoomSchema = new mongoose.Schema({
            ownerId: String,
            participants: [{
                email: String,
                userId: String,
                assignedRole: String,
                invitedRole: String
            }]
        }, { strict: false });

        const Room = mongoose.model('Room', RoomSchema, 'rooms');
        const room = await Room.findById(ROOM_ID);

        if (!room) {
            console.log('Room not found!');
            return;
        }

        console.log('--- Room Info ---');
        console.log('Room ID:', room._id);
        console.log('Owner ID:', room.ownerId);
        console.log('Participants:');
        room.participants.forEach(p => {
            console.log(`- Email: ${p.email}, UserId: ${p.userId}, AssignedRole: ${p.assignedRole}, InvitedRole: ${p.invitedRole}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkRoom();
