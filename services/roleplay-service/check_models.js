import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
console.log(`🔑 Checking Key: ${apiKey ? apiKey.substring(0, 5) + "..." : "❌ NONE"}`);

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function check() {
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("❌ Google Error:", data.error.message);
        } else {
            console.log("\n✅ ALL YOUR AVAILABLE MODELS:");
            data.models.forEach(m => {
                console.log(`   "${m.name.replace("models/", "")}" [Methods: ${m.supportedGenerationMethods.join(', ')}]`);
            });
        }
    } catch (e) {
        console.error("❌ Network Error:", e);
    }
}

check();
