#!/bin/bash
set -e

echo "=== File timestamps in container ==="
docker exec lawnova-roleplay-service ls -la /app/src/utils/aiOrchestrator.js
docker exec lawnova-roleplay-service ls -la /app/src/controllers/chatController.js

echo ""
echo "=== GEMINI_MODEL line in patched file ==="
docker exec lawnova-roleplay-service grep -n "GEMINI_MODEL" /app/src/utils/aiOrchestrator.js | head -5

echo ""
echo "=== Error handler middleware ==="
docker exec lawnova-roleplay-service cat /app/src/middleware/errorHandler.js

echo ""
echo "=== Gemini direct test (from inside container) ==="
docker exec lawnova-roleplay-service node --input-type=module << 'NODESCRIPT'
process.env.GEMINI_API_KEY = 'AIzaSyBH_imJKg8CB9XlR7QcNUNuwD47fuIK8z4';
try {
  const { generateCaseScenario } = await import('/app/src/utils/aiOrchestrator.js');
  const result = await generateCaseScenario('Easy', 'Random', 'Defense');
  console.log('SUCCESS:', JSON.stringify(result).substring(0, 300));
} catch(e) {
  console.error('FAIL:', e.message);
  console.error('CODE:', e.status || e.code || e.httpErrorCode?.status || 'none');
}
NODESCRIPT
