
test_model() {
  local MODEL=$1
  local API_VER=$2
  local URL="https://generativelanguage.googleapis.com/${API_VER}/models/${MODEL}:generateContent?key=${GEMINI_KEY}"
  local CODE=$(curl -s -o /tmp/gem_resp.json -w "%{http_code}" \
    "$URL" -H 'Content-Type: application/json' -X POST \
    -d '{"contents":[{"parts":[{"text":"Say OK"}]}]}' --max-time 15)
  local MSG=$(cat /tmp/gem_resp.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','OK')[:80] if 'error' in d else 'OK')" 2>/dev/null || echo "check /tmp/gem_resp.json")
  echo "  [$CODE] $MODEL ($API_VER) -> $MSG"
}

echo "=== Testing model names ==="
test_model "gemini-2.5-flash-preview-04-17" "v1beta"
test_model "gemini-2.5-flash"               "v1beta"
test_model "gemini-2.5-flash-preview-04-17" "v1alpha"
test_model "gemini-2.0-flash"               "v1beta"
test_model "gemini-2.0-flash"               "v1"
test_model "gemini-1.5-flash-latest"        "v1beta"

echo ""
echo "=== Update container with working model and restart ==="
# Will be updated after we know which model works
