import fetch from 'node-fetch';

async function testStream() {
    console.log("Testing AI Service Stream...");
    try {
        const response = await fetch('http://localhost:5008/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: 'What is a crime?' }
                ],
                sessionId: 'test-session-final'
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        const reader = response.body;
        reader.on('data', (chunk) => {
            console.log('Chunk:', chunk.toString());
        });

        reader.on('end', () => {
            console.log('\n[Stream Completed]');
        });
    } catch (e) {
        console.error('Error testing stream:', e.message);
    }
}

testStream();
