import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- FIX START: Define the standard font path ---
// Go up 2 levels: scripts -> dataset -> roleplay-service (where node_modules is)
const FONT_PATH = path.join(__dirname, '../../node_modules/pdfjs-dist/standard_fonts/');
// --- FIX END ---

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function processPDFs() {
    const directoryPath = path.join(__dirname, '../../roleplay-service/dataset/lk_act_data');

    if (!fs.existsSync(directoryPath)) {
        console.error("Directory not found:", directoryPath);
        return;
    }

    // Recursively find all PDFs in subfolders
    const getAllFiles = (dirPath, arrayOfFiles) => {
        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];
        files.forEach((file) => {
            if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            } else if (file.endsWith(".pdf")) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        });
        return arrayOfFiles;
    };

    const files = getAllFiles(directoryPath);
    console.log(`Found ${files.length} PDF files.`);

    for (const filePath of files) {
        const fileName = path.basename(filePath);
        console.log(`Processing: ${fileName}`);

        try {
            const dataBuffer = fs.readFileSync(filePath);

            // --- FIX START: Pass options to include the font path ---
            const options = {
                standardFontDataUrl: FONT_PATH
            };
            const data = await pdf(dataBuffer, options);
            // --- FIX END ---

            const rawText = data.text;
            if (!rawText || rawText.trim().length === 0) {
                console.warn(`Empty text in ${fileName}, skipping...`);
                continue;
            }

            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const docChunks = await splitter.splitText(rawText);

            const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

            for (let i = 0; i < docChunks.length; i++) {
                const result = await model.embedContent(docChunks[i]);
                const embedding = result.embedding.values;

                await index.upsert([{
                    id: `${fileName}-${i}`.replace(/\s+/g, '_'), // Clean ID
                    values: embedding,
                    metadata: {
                        text: docChunks[i],
                        source: fileName,
                        path: filePath,
                        type: "Sri Lankan Act"
                    }
                }]);
            }
            console.log(`✅ Finished ${fileName}`);
        } catch (err) {
            console.error(`❌ Error processing ${fileName}:`, err.message);
        }
    }
}

processPDFs().catch(err => console.error("Fatal Error:", err));