import fs from 'fs';

// CONFIG: Match your local setup
const AI_SERVICE_URL = 'http://localhost:5008/api';
const MOCKTRIAL_SERVICE_URL = 'http://localhost:10004/api';
const TEST_ROOM_ID = '69ad0ac8c50e1804f549136d'; // Use your existing room ID

async function runTest() {
    try {
        console.log('--- 🚀 STARTING RAG + MCQ PIPELINE TEST ---');

        // 1. Load the dialogue script
        const dialogue = JSON.parse(fs.readFileSync('./test_dialogue.json', 'utf8'));
        console.log(`[Test] Loaded ${dialogue.length} dialogue messages.`);

        // 2. Ingest messages into the AI Service (simulate live courtroom)
        console.log('[Test] Ingesting messages into AI Service cache...');
        for (const msg of dialogue) {
            await fetch(`${AI_SERVICE_URL}/transcript/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'TRANSCRIPTION_MESSAGE',
                    sessionId: TEST_ROOM_ID,
                    message: {
                        ...msg,
                        timestamp: new Date().toISOString(),
                        confidence: 1
                    }
                })
            });
        }
        console.log('[Success] Transcript ingested successfully.');

        // 3. Trigger the Learning Pipeline via MockTrial Service
        console.log('[Test] Triggering Learning Material Generation...');
        const triggerResponse = await fetch(`${MOCKTRIAL_SERVICE_URL}/rooms/${TEST_ROOM_ID}/trigger-learning`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-id': '694a4ef5c579156d8647086d', // The Owner in the DB
                'user-email': 'janithviranga001@gmail.com'
            }
        });

        const triggerData = await triggerResponse.json();

        console.log('[Success] AI Pipeline Triggered!');

        if (triggerData.success && triggerData.data) {
            const { flashcards, quizzes } = triggerData.data;
            console.log('--- 📊 GENERATION SUMMARY ---');
            console.log(`Total Flashcards: ${flashcards?.length || 0}`);
            console.log(`Total Quizzes:    ${quizzes?.length || 0}`);

            if (flashcards?.length > 0) {
                console.log('\nSample Flashcard:', JSON.stringify(flashcards[0], null, 2));
            }
            if (quizzes?.length > 0) {
                console.log('\nSample Quiz:', JSON.stringify(quizzes[0], null, 2));
            }

            if (flashcards?.length > 0 && quizzes?.length > 0) {
                console.log('\n✅ PIPELINE FULLY FUNCTIONAL!');
            } else {
                console.warn('\n⚠️ Pipeline working but returned empty data. Check Transcript context length.');
            }
        } else {
            console.error('❌ Pipeline failed:', triggerData.message || 'Unknown error');
        }

    } catch (err) {
        console.error('[Error] Pipeline Test Failed:', err.message);
    }
}

runTest();
