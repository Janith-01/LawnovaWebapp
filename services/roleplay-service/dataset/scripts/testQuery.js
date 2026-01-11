import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";

// --- SETUP ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Check for the key you used (GEMINI_API_KEY based on your logs)
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error("❌ No API Key found in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const chroma = new ChromaClient({ path: "http://localhost:8000" });
const COLLECTION_NAME = "sri_lanka_law";

// --- QUERY FUNCTION ---
async function queryLaw(question) {
    console.log(`\n🔎 Asking: "${question}"...`);

    try {
        const collection = await chroma.getCollection({ name: COLLECTION_NAME });

        // 1. Convert the question into a vector using Gemini
        const result = await embeddingModel.embedContent(question);
        const queryVector = result.embedding.values;

        // 2. Search Chroma for the closest vectors
        const searchResults = await collection.query({
            queryEmbeddings: [queryVector],
            nResults: 2, // Get top 2 matches
        });

        // 3. Print Results
        if (searchResults.documents[0].length === 0) {
            console.log("⚠️ No relevant laws found.");
        } else {
            console.log("\n✅ Found Relevant Law Sections:");
            searchResults.documents[0].forEach((doc, index) => {
                const source = searchResults.metadatas[0][index]?.source || "Unknown";
                console.log(`\n--- Match #${index + 1} (Source: ${source}) ---`);
                console.log(doc.substring(0, 300) + "..."); // Print first 300 chars
            });
        }

    } catch (error) {
        console.error("❌ Query failed:", error);
    }
}

// Run a test question
queryLaw("What is the punishment for theft?");