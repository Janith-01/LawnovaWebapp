import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// FIX: Use 'text-embedding-004' (Better limits than embedding-001)
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const chroma = new ChromaClient({ path: "http://localhost:8000" });
const COLLECTION_NAME = "sri_lanka_law";

export async function findRelevantLaws(userQuery) {
    try {
        console.log(`🔍 Searching laws for: "${userQuery}"`);
        const collection = await chroma.getCollection({ name: COLLECTION_NAME });

        const result = await embeddingModel.embedContent(userQuery);
        const queryVector = result.embedding.values;

        const searchResults = await collection.query({
            queryEmbeddings: [queryVector],
            nResults: 2,
        });

        if (!searchResults.documents[0] || searchResults.documents[0].length === 0) {
            return null;
        }

        return searchResults.documents[0].join("\n\n");

    } catch (error) {
        console.error("❌ Law retrieval failed:", error.message);
        // We allow it to return null so the chat can continue even if search fails
        return null;
    }
}