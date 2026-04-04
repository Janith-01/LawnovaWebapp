// Quick test to see if the session creation endpoint works
import fetch from 'node-fetch';

const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzZiNDA3ZWQ4YWM2YzMyMzY0ZjQ0YjgiLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTczNDczMzQ4OCwiZXhwIjoxNzM0NzM3MDg4fQ.dGOTqWYl5yRMxEL4pBH5eGAR5KsNkGr1sUmvSXqVEq4';

const payload = {
  title: 'Test Session',
  caseType: 'commercial',
  caseTitle: 'Test Case',
  description: 'Test description',
  scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  durationMinutes: 5,
  timezone: 'Asia/Colombo',
  maxParticipants: 10,
  isPrivate: true,
};

console.log('Testing session creation...\n');

async function testViaGateway() {
  console.log('1. Testing via Gateway (localhost:5000)...');
  try {
    const res = await fetch('http://localhost:5000/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `access_token=${JWT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, text.substring(0, 200));
  } catch (err) {
    console.error(`   Error:`, err.message);
  }
}

async function testDirectMocktrial() {
  console.log('\\n2. Testing direct to mocktrial-service (localhost:5003)...');
  try {
    const res = await fetch('http://localhost:5003/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': '676b407ed8ac6c32364f44b8',
        'x-user-role': 'student',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, text.substring(0, 200));
  } catch (err) {
    console.error(`   Error:`, err.message);
  }
}

async function run() {
  await testViaGateway();
  await testDirectMocktrial();
  console.log('\nDone.');
}

run();
