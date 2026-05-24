#!/bin/sh
# Serv00 / FreeBSD deployment setup for Xugou backend
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

echo "==> Installing dependencies (skipping Cloudflare dev tools)..."
npm install --omit=dev 2>&1 || {
  echo "--> npm install failed, trying without optional deps..."
  npm install --omit=dev --omit=optional 2>&1
}

# Check if better-sqlite3 installed, otherwise fall back to sql.js
if node -e "require('better-sqlite3')" 2>/dev/null; then
  echo "==> better-sqlite3 installed (native, low memory)"
  USE_NATIVE=1
else
  echo "==> better-sqlite3 not available, using sql.js (WASM)"
  echo "    Consider installing build tools: pkg install python3 gmake gcc"
  USE_NATIVE=0
fi

echo "==> Building TypeScript..."
npx tsc -p tsconfig.node.json 2>&1 || {
  echo "--> tsc build failed, trying with local tsc..."
  ./node_modules/.bin/tsc -p tsconfig.node.json 2>&1
}
echo '{"type":"commonjs"}' > dist/package.json
echo "==> Build complete"

echo ""
echo "==> Setup done. Start with:"
echo "    cd $BACKEND_DIR/serv00 && node app.cjs"
echo ""
echo "    RESTART_MINUTES=30 PORT=5411 node app.cjs   (custom settings)"
