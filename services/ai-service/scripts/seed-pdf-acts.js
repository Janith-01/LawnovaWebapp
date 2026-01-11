import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

// Standard ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function processPDFs() {
    // Correct relative path to your dataset
    const directoryPath = path.join(__dirname, '../../roleplay-service/dataset/lk_act_data/data/lk_acts');

    if (!fs.existsSync(directoryPath)) {
        console.error("Directory not found:", directoryPath);
        return;
    }

    // Recursive function to get all PDF files
    function getFilesRecursively(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFilesRecursively(filePath));
            } else if (file.toLowerCase().endsWith('.pdf')) {
                results.push(filePath);
            }
        });
        return results;
    }

    const files = getFilesRecursively(directoryPath);
    console.log(`Found ${files.length} PDF files.`);

    // Use a limit for testing if needed (uncomment to test with fewer files)
    // const filesToProcess = files.slice(0, 5);
    const filesToProcess = files;

    for (const file of filesToProcess) {
        console.log(`Processing: ${file}`);
        const dataBuffer = fs.readFileSync(file);
        const dataUint8 = new Uint8Array(dataBuffer);

        try {
            // Handle pdf-parse export variations (function vs object vs PDFParse class)
            // Usage for this version appears to be: new pdf.PDFParse(uint8Array).getText()
            const pdfFunc = typeof pdf === 'function' ? pdf : (pdf.default || pdf.PDFParse || pdf);

            if (typeof pdfFunc !== 'function') {
                throw new Error(`pdf-parse is not a function. Type: ${typeof pdf}`);
            }

            let textContent = '';

            try {
                // Try instantiating as class (required for v2 used here)
                const instance = new pdfFunc(dataUint8);
                if (instance.getText) {
                    const textResult = await instance.getText();
                    textContent = typeof textResult === 'string' ? textResult : (textResult.text || '');
                } else if (instance.text) {
                    textContent = instance.text;
                } else {
                    // Fallback check
                    textContent = JSON.stringify(instance);
                }
            } catch (e) {
                // Fallback for function style (v1)
                const data = await pdfFunc(dataBuffer);
                textContent = data.text;
            }

            if (!textContent) {
                console.warn(`No text content extracted from ${file}`);
                continue;
            }

            const rawText = textContent;

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
                    id: `${file}-${i}`,
                    values: embedding,
                    metadata: {
                        text: docChunks[i],
                        source: file,
                        type: "Sri Lankan Act"
                    }
                }]);
            }
            console.log(`Finished ${file}`);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
            break; // Stop after first error to debug
        }
    }
}

processPDFs().catch(err => console.error(err));