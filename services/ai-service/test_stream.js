import axios from 'axios';

async function testStream() {
    try {
        console.log("Testing stream endpoint...");
        const response = await fetch('http://localhost:5008/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: 'What is a crime?' }
                ],
                sessionId: 'test-session-123'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Status: ${response.status}`);
            console.error(`Error: ${errorText}`);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        console.log("Reading stream...");
        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            const chunkValue = decoder.decode(value);
            console.log("Chunk:", chunkValue);
        }
        console.log("Stream finished.");

    } catch (error) {
        console.error("Fetch Error:", error.message);
    }
}

testStream();
