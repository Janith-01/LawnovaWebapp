import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChromaClient } from 'chromadb';
import dotenv from 'dotenv';
dotenv.config();

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
const chroma = new ChromaClient({ host: "localhost", port: 8000 });

export async function retrieveRelevantLaws(userArgument) {
    try {
        // 1. Check if Chroma is alive
        const heartbeat = await chroma.heartbeat();
        if (!heartbeat) return null;

        // 2. Convert User's Argument to Vector (Numbers)
        const result = await embeddingModel.embedContent(userArgument);
        const userVector = result.embedding.values;

        // 3. Search the Database
        const collection = await chroma.getCollection({
            name: "sri_lankan_law",
            embeddingFunction: { generate: () => [] } // Match the ingestion script
        });
        const searchResults = await collection.query({
            queryEmbeddings: [userVector],
            nResults: 2 // Get top 2 most relevant sections
        });

        // 4. Format the results
        const documents = searchResults.documents[0];
        const metadatas = searchResults.metadatas[0];

        if (!documents || documents.length === 0) {
            return null;
        }

        // Combine text with its source (e.g., "Penal Code Section 300")
        const formattedLaws = documents.map((doc, index) => {
            const source = metadatas[index]?.source || "Legal Reference";
            return `[SOURCE: ${source}]\n${doc}`;
        }).join("\n\n");

        return formattedLaws;

    } catch (error) {
        console.warn("⚠️ Vector DB Search skipped:", error.message);
        return null;
    }
}
