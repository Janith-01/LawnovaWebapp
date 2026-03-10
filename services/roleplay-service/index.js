import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import the controller directly to avoid Router wiring issues
import { consultLaw } from './src/controllers/chatController.js';
import chatRoutes from './src/routes/chatRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. DIRECT DEBUG ROUTE (This fixes the 404)
// We mount this explicitly so we know it exists.
app.post('/api/consult-law', (req, res, next) => {
    console.log("🔔 Incoming Request: POST /api/consult-law");
    next();
}, consultLaw);

// 2. Load other routes
app.use('/api', chatRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('Lawnova Roleplay Service is Running 🚀');
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`⚖️  Lawnova Backend running on port ${PORT}`);
    console.log(`👉 Manual Route Active: POST http://localhost:${PORT}/api/consult-law`);
    console.log(`================================================\n`);
});
