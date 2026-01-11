import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
console.log("Using OpenAI Key:", apiKey ? apiKey.substring(0, 8) + "..." : "NONE");

if (!apiKey) {
    console.error("No OpenAI Key");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: apiKey });

async function run() {
    console.log("\nTesting gpt-3.5-turbo...");
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "Hello" }],
            model: "gpt-3.5-turbo",
        });
        console.log(`✅ OpenAI WORKED! Response: ${completion.choices[0].message.content}`);
    } catch (e) {
        console.log(`❌ OpenAI Failed: ${e.message}`);
    }
}

run();
