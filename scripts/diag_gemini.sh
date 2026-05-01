#!/bin/bash
# Direct Gemini API test - no Docker needed
echo "=== Testing Gemini API key directly ==="

GEMINI_KEY="Your GEMINI API KEY "
MODEL="gemini-2.5-flash-preview-04-17"

RESPONSE=$(curl -s -w "\n---HTTP:%{http_code}---" \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{"contents":[{"parts":[{"text":"Say OK"}]}]}' \
  --max-time 30)

echo "Response: $RESPONSE"

# Extract HTTP status
HTTP_CODE=$(echo "$RESPONSE" | grep -o 'HTTP:[0-9]*' | cut -d: -f2)
echo ""
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Gemini API is working fine!"
elif [ "$HTTP_CODE" = "429" ]; then
  echo "❌ QUOTA EXCEEDED - API key has hit rate limit!"
elif [ "$HTTP_CODE" = "400" ]; then
  echo "❌ BAD REQUEST - Check model name"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ FORBIDDEN - API key invalid or not enabled for this model"
else
  echo "❌ Unexpected status: $HTTP_CODE"
fi

echo ""
echo "=== Also check error handler logging ==="
docker exec lawnova-roleplay-service grep -n "console.error\|logger.error" /app/src/middleware/errorHandler.js || echo "No error logging in errorHandler!"

echo ""
echo "=== Add logging to errorHandler and test ==="
# Patch errorHandler to log errors
docker exec lawnova-roleplay-service sh -c "
cat > /tmp/errorHandler.js << 'EOF'
export const notFound = (req, res, next) => {
    const error = new Error('Not Found - ' + req.originalUrl);
    res.status(404);
    next(error);
};

export const errorHandler = (err, req, res, next) => {
    console.error('[ERROR_HANDLER] Caught error:', err.message);
    console.error('[ERROR_HANDLER] Stack:', err.stack);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
};

export default { notFound, errorHandler };
EOF
cp /tmp/errorHandler.js /app/src/middleware/errorHandler.js
echo 'errorHandler patched with logging'
"
