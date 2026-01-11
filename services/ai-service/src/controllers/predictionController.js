import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load mock cases
const mockCasesPath = join(__dirname, '../data/mockCases.json');
const mockCases = JSON.parse(readFileSync(mockCasesPath, 'utf-8'));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * TF-IDF Based Similarity Calculation
 * Simple implementation for finding similar cases
 */
class TFIDFMatcher {
    constructor(documents) {
        this.documents = documents;
        this.vocabulary = new Set();
        this.idf = {};
    }

    tokenize(text) {
        // Simple tokenization: lowercase, remove punctuation, split by whitespace
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3); // Filter short words
    }

    calculateTF(tokens) {
        const tf = {};
        const totalTokens = tokens.length;

        tokens.forEach(token => {
            tf[token] = (tf[token] || 0) + 1;
        });

        // Normalize by total tokens
        Object.keys(tf).forEach(token => {
            tf[token] = tf[token] / totalTokens;
        });

        return tf;
    }

    buildVocabulary() {
        this.documents.forEach(doc => {
            const tokens = this.tokenize(doc.factDescription);
            tokens.forEach(token => this.vocabulary.add(token));
        });
    }

    calculateIDF() {
        const docCount = this.documents.length;

        this.vocabulary.forEach(term => {
            let docsContainingTerm = 0;

            this.documents.forEach(doc => {
                const tokens = this.tokenize(doc.factDescription);
                if (tokens.includes(term)) {
                    docsContainingTerm++;
                }
            });

            this.idf[term] = Math.log(docCount / (docsContainingTerm + 1));
        });
    }

    calculateTFIDF(text) {
        const tokens = this.tokenize(text);
        const tf = this.calculateTF(tokens);
        const tfidf = {};

        Object.keys(tf).forEach(token => {
            tfidf[token] = tf[token] * (this.idf[token] || 0);
        });

        return tfidf;
    }

    cosineSimilarity(vec1, vec2) {
        const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;

        allTerms.forEach(term => {
            const val1 = vec1[term] || 0;
            const val2 = vec2[term] || 0;
            dotProduct += val1 * val2;
            mag1 += val1 * val1;
            mag2 += val2 * val2;
        });

        if (mag1 === 0 || mag2 === 0) return 0;
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }

    findMostSimilar(queryText) {
        this.buildVocabulary();
        this.calculateIDF();

        const queryVector = this.calculateTFIDF(queryText);
        let maxSimilarity = 0;
        let mostSimilarCase = null;

        this.documents.forEach(doc => {
            const docVector = this.calculateTFIDF(doc.factDescription);
            const similarity = this.cosineSimilarity(queryVector, docVector);

            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                mostSimilarCase = { ...doc, similarityScore: similarity };
            }
        });

        return mostSimilarCase;
    }
}

/**
 * Predict Legal Judgment
 * POST /api/ai/predict-judgment
 */
export const predictJudgment = async (req, res) => {
    try {
        const { factDescription } = req.body;

        // Validation
        if (!factDescription || factDescription.trim().length < 50) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a detailed case description (minimum 50 characters).'
            });
        }

        console.log('🔍 Analyzing case scenario...');

        // Find most similar case using TF-IDF
        const matcher = new TFIDFMatcher(mockCases);
        const similarCase = matcher.findMostSimilar(factDescription);

        if (!similarCase) {
            return res.status(500).json({
                success: false,
                message: 'Unable to find similar cases in database.'
            });
        }

        console.log(`📊 Most similar case: ${similarCase.caseTitle} (${(similarCase.similarityScore * 100).toFixed(2)}% match)`);

        // Use Gemini AI to analyze and generate prediction
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.4, // Lower temperature for more consistent legal analysis
                maxOutputTokens: 1500,
            }
        });

        const prompt = `You are a Sri Lankan legal expert analyzing a criminal case for judgment prediction.

USER'S CASE SCENARIO:
${factDescription}

MOST SIMILAR PRECEDENT CASE:
Title: ${similarCase.caseTitle}
Facts: ${similarCase.factDescription}
Legal Issues: ${similarCase.legalIssues}
Relevant Statutes: ${similarCase.relevantStatutes}
Historical Verdict: ${similarCase.historicalVerdict}
Reasoning: ${similarCase.reasoning}

TASK:
Analyze the user's case scenario and predict the likely judgment based on the similar precedent case.

Return ONLY a valid JSON object with this EXACT structure (no additional text):
{
  "predictedVerdict": "Guilty" or "Not Guilty",
  "confidenceScore": <number between 0-100>,
  "legalJustification": "<detailed 2-3 paragraph explanation citing specific Sri Lankan Penal Code sections and legal principles>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "similarPrecedents": ["${similarCase.caseTitle}"],
  "relevantStatutes": ["<statute 1>", "<statute 2>"],
  "prosecutionStrength": <number 0-100>,
  "defenseStrength": <number 0-100>
}

IMPORTANT: Base your prediction on actual legal principles from Sri Lankan law. Consider:
1. Mens Rea (criminal intent) evidence
2. Actus Reus (criminal act) proof
3. Available defenses
4. Burden of proof (beyond reasonable doubt)
5. Similarities and differences with the precedent case`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Parse JSON response
        let predictionData;
        try {
            // Remove markdown code blocks if present
            const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            predictionData = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', responseText);
            throw new Error('AI response was not in expected JSON format');
        }

        // Calculate overall confidence based on similarity and AI confidence
        const overallConfidence = Math.round(
            (similarCase.similarityScore * 30) + (predictionData.confidenceScore * 0.7)
        );

        const response = {
            success: true,
            prediction: {
                verdict: predictionData.predictedVerdict,
                confidence: overallConfidence,
                justification: predictionData.legalJustification,
                keyFactors: predictionData.keyFactors || [],
                similarCases: [
                    {
                        title: similarCase.caseTitle,
                        verdict: similarCase.historicalVerdict,
                        similarity: Math.round(similarCase.similarityScore * 100),
                        statutes: similarCase.relevantStatutes
                    }
                ],
                statutes: predictionData.relevantStatutes || [similarCase.relevantStatutes],
                strengthAnalysis: {
                    prosecution: predictionData.prosecutionStrength || 50,
                    defense: predictionData.defenseStrength || 50
                }
            },
            disclaimer: 'This is an AI-generated prediction based on historical cases and should not be considered legal advice. Consult a qualified attorney for actual legal matters.'
        };

        console.log(`✅ Prediction complete: ${predictionData.predictedVerdict} (${overallConfidence}% confidence)`);

        res.json(response);

    } catch (error) {
        console.error('❌ Prediction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate prediction. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Mock Cases (for reference)
 * GET /api/ai/cases
 */
export const getMockCases = async (req, res) => {
    try {
        const cases = mockCases.map(c => ({
            id: c.id,
            title: c.caseTitle,
            verdict: c.historicalVerdict,
            statutes: c.relevantStatutes
        }));

        res.json({
            success: true,
            cases,
            total: cases.length
        });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cases'
        });
    }
};
