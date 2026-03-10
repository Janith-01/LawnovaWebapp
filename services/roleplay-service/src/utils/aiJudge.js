import axios from 'axios';

// 1. Define the URL of your Python Microservice
// We use 127.0.0.1 instead of localhost to avoid Node v17+ DNS issues
// Pointing to the new Dual-Model AI Engine on Port 5009
const PYTHON_SERVICE_URL = 'http://127.0.0.1:5009/predict';

/**
 * Sends the user's argument to the Python AI Judge.
 * @param {string} userText - The argument typed by the user.
 * @returns {number} - The probability of winning (0-100).
 */
async function getWinProbability(userText) {
    try {
        console.log(`⚖️  Connecting to AI Judge at ${PYTHON_SERVICE_URL}...`);

        // 2. Send POST request to Python
        // timeout: 5000ms means we wait 5 seconds max before giving up
        const response = await axios.post(PYTHON_SERVICE_URL, {
            text: userText
        }, { timeout: 5000 });

        // 3. Check if Python said "success"
        if (response.data && response.data.status === 'success') {
            const score = response.data.win_probability;
            console.log(`✅ AI Judge Score: ${score}%`);
            return score;
        } else {
            console.warn("⚠️ AI Judge returned success=false");
            return 50.0; // Default fallback score
        }

    } catch (error) {
        // 4. Robust Error Handling
        if (error.code === 'ECONNREFUSED') {
            console.error("❌ CRITICAL: Python Service is OFFLINE. Is 'python app.py' running?");
        } else {
            console.error(`⚠️ AI Judge Error: ${error.message}`);
        }
        // Return neutral score so the game doesn't crash
        return 50.0;
    }
}

export { getWinProbability };
