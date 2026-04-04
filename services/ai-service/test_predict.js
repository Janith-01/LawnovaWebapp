import axios from 'axios';

async function testPredict() {
    try {
        console.log("Testing Python Predict (Port 5009)...");
        const resp1 = await axios.post('http://127.0.0.1:5009/predict', { text: "Hi" });
        console.log("Response for 'Hi':", resp1.data);

        const resp2 = await axios.post('http://127.0.0.1:5009/predict', { text: "Section 366 of the Penal Code defines theft as moving property out of the possession of any person without that person's consent with intent to take dishonestly." });
        console.log("Response for strong argument:", resp2.data);
    } catch (e) {
        console.error("Predict Test Error:", e.message);
    }
}

testPredict();
