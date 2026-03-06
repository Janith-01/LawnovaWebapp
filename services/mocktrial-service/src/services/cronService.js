import cron from 'node-cron';
import Room from '../models/Room.js';
import { deleteDailyRoom } from '../utils/aiServiceClient.js';

export const initCronJobs = () => {
    console.log('[Cron] Initializing scheduled tasks...');

    // Runs every minute - Auto-complete expired sessions
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Find active rooms (Scheduled or RolesAssigned)
            const rooms = await Room.find({
                roomStatus: { $in: ['Scheduled', 'RolesAssigned', 'InProgress'] }
            });

            let completedCount = 0;

            for (const room of rooms) {
                if (!room.scheduledDate || !room.scheduledTime) continue;

                // Combine Date and Time
                const start = new Date(room.scheduledDate);
                const [hours, mins] = room.scheduledTime.split(':').map(Number);
                start.setHours(hours, mins, 0, 0);

                const durationMinutes = room.duration || 60;
                const end = new Date(start.getTime() + durationMinutes * 60000);

                if (now > end) {
                    // Session has passed - auto-complete
                    console.log(`[Cron] Auto-completing session ${room._id}. Planned End: ${end.toISOString()}`);

                    room.roomStatus = 'Completed';
                    room.completedAt = new Date();
                    await room.save();

                    // Close the Daily.co room if it exists
                    if (room.dailyRoomName) {
                        try {
                            await deleteDailyRoom(room.dailyRoomName);
                            console.log(`[Cron] Closed Daily room: ${room.dailyRoomName}`);
                        } catch (dailyErr) {
                            console.warn(`[Cron] Could not close Daily room: ${dailyErr.message}`);
                        }
                    }

                    completedCount++;
                }
            }

            if (completedCount > 0) {
                console.log(`[Cron] Auto-completed ${completedCount} sessions.`);
            }

        } catch (error) {
            console.error('[Cron] Error in session cleanup job:', error);
        }
    });

    // Runs every 5 minutes - Cleanup stale rooms (older than 7 days and completed)
    cron.schedule('*/5 * * * *', async () => {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const staleRooms = await Room.find({
                roomStatus: 'Completed',
                completedAt: { $lt: sevenDaysAgo },
                dailyRoomName: { $exists: true, $ne: '' }
            });

            for (const room of staleRooms) {
                try {
                    await deleteDailyRoom(room.dailyRoomName);
                    room.dailyRoomName = ''; // Clear to prevent re-deletion
                    room.dailyRoomUrl = '';
                    await room.save();
                    console.log(`[Cron] Archived stale room: ${room._id}`);
                } catch (err) {
                    // Ignore errors - room might already be deleted
                }
            }
        } catch (error) {
            console.error('[Cron] Error in stale cleanup job:', error);
        }
    });

    console.log('[Cron] Tasks scheduled.');
};
