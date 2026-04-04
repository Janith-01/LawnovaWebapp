import axios from 'axios';

async function testAI() {
    try {
        const response = await axios.get('http://localhost:5008/health');
        console.log("Health Check:", response.data);

        const testResp = await axios.get('http://localhost:5008/api/test');
        console.log("AI Test Result:", testResp.data);
    } catch (error) {
        if (error.response) {
            console.error("Error Response Data:", error.response.data);
            console.error("Error Response Status:", error.response.status);
        } else {
            console.error("Error Message:", error.message);
        }
    }
}

testAI();
