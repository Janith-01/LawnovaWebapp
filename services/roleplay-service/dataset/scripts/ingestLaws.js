import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";

// --- 1. CONFIGURATION & SETUP ---

// Fix for ES Modules to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the root of roleplay-service (two levels up)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Debugging: Verify Key Loading
console.log("------------------------------------------------");
console.log("DEBUG: Checking configuration...");
console.log("Target .env path:", envPath);
console.log("GEMINI_API_KEY Loaded:", process.env.GEMINI_API_KEY ? "✅ Yes" : "❌ NO (Check your .env file)");
console.log("------------------------------------------------");

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: No Google API Key found. Exiting.");
    process.exit(1);
}

// Initialize Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" }); // Using stable model
const chroma = new ChromaClient({ path: "http://localhost:8000" }); // Port 8000 is default

// Configuration
const DATA_DIR = path.resolve(__dirname, '../lk_act_data'); // Folder containing your law text files
const COLLECTION_NAME = "sri_lanka_law";

// --- 2. HELPER FUNCTIONS ---

// Function to generate embeddings using Gemini
async function getEmbeddings(text) {
    try {
        // Gemini expects the text slightly cleaner, replace newlines if needed
        const cleanText = text.replace(/\n/g, " ");
        const result = await embeddingModel.embedContent(cleanText);
        return result.embedding.values;
    } catch (error) {
        console.error("❌ Error generating embedding:", error.message);
        throw error;
    }
}

// Recursively get all .txt files from the directory
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith(".txt")) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

// --- 3. MAIN INGESTION LOGIC ---

async function ingestData() {
    console.log("📚 Starting Law Library Ingestion...");

    // 1. Check Data Directory
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Error: Data directory not found at: ${DATA_DIR}`);
        return;
    }

    // 2. Scan for Files
    console.log(`Scanning for law files in: ${DATA_DIR}`);
    let files = [];
    try {
        files = getAllFiles(DATA_DIR);
    } catch (e) {
        console.error("❌ Error reading directory:", e.message);
        return;
    }

    if (files.length === 0) {
        console.log("⚠️ No .txt files found to ingest.");
        return;
    }
    console.log(`Found ${files.length} documents.`);

    // 3. Connect/Create Collection
    console.log("Connecting to Chroma DB...");
    let collection;
    try {
        // Delete existing to start fresh (Optional - comment out if you want to append)
        try {
            await chroma.deleteCollection({ name: COLLECTION_NAME });
            console.log("Cleared old data.");
        } catch (e) { /* Ignore if doesn't exist */ }

        collection = await chroma.getOrCreateCollection({
            name: COLLECTION_NAME,
            metadata: { "description": "Sri Lanka Law Penal Codes" }
        });
    } catch (e) {
        console.error("❌ Failed to connect to Chroma. Is Docker running?", e.message);
        return;
    }

    // 4. Process Each File
    for (const filePath of files) {
        const fileName = path.basename(filePath);
        console.log(`Processing: ${fileName}...`);

        try {
            const text = fs.readFileSync(filePath, 'utf-8');

            // Skip empty files
            if (!text.trim()) {
                console.log("Skipping empty file.");
                continue;
            }

            // Generate Vector
            const vector = await getEmbeddings(text);

            // Add to Chroma
            // We explicitily pass 'embeddings' to avoid the "missing default-embed" error
            await collection.add({
                ids: [fileName],                 // ID is the filename
                metadatas: [{ source: fileName }], // Metadata
                documents: [text],               // The actual text
                embeddings: [vector]             // The AI-generated vector
            });

            console.log(`✅ Successfully added ${fileName}`);

        } catch (error) {
            console.error(`❌ Failed to process ${fileName}:`, error.message);
        }
    }

    console.log("\n🎉 Ingestion Complete!");
}

// Run the script
ingestData();