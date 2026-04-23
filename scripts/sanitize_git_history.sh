#!/usr/bin/env bash
set -euo pipefail

# Run from repository root in a fresh clone.
# This rewrites Git history. Coordinate with your team before running.

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "git-filter-repo is required. Install it first:"
  echo "  pip install git-filter-repo"
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "Error: run this script from the repository root (where .git exists)."
  exit 1
fi

tmp_replace_file="$(mktemp)"
trap 'rm -f "$tmp_replace_file"' EXIT

cat > "$tmp_replace_file" <<'EOF'
regex:mongodb\+srv://[^[:space:]'"]+:[^[:space:]'"]+@mocktrails\.gl9ftpc\.mongodb\.net/\?appName=Mocktrails==>MONGODB_URI_REDACTED
regex:pcsk_[A-Za-z0-9_]+==>PINECONE_API_KEY_REDACTED
regex:AIza[0-9A-Za-z_-]{30,}==>GEMINI_API_KEY_REDACTED
dev-token==>SERVICE_AUTH_TOKEN_REDACTED
internal-service-secret-not-configured==>INTERNAL_SERVICE_SECRET_REDACTED
EOF

echo "Rewriting Git history with git-filter-repo..."
git filter-repo --force --replace-text "$tmp_replace_file"

echo ""
echo "History rewrite complete."
echo "Next steps:"
echo "1) Rotate all leaked credentials in external systems immediately."
echo "2) Force-push rewritten history:"
echo "   git push --force --all origin"
echo "   git push --force --tags origin"
echo "3) Ask all collaborators to re-clone or hard-reset to the new history."
