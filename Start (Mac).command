#!/bin/bash
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS version from https://nodejs.org/ then double-click this file again."
  read -n 1 -s -r -p "Press any key to close"
  exit 1
fi
echo "Getting DreamBinder ready (the first time takes a minute or two)..."
npm install --no-audit --no-fund || { read -n 1 -s -r -p "Install failed. Press any key to close"; exit 1; }
npm run build || { read -n 1 -s -r -p "Build failed. Press any key to close"; exit 1; }
(sleep 4; open http://localhost:3000) &
echo
echo "DreamBinder is running at http://localhost:3000 - leave this window open. Close it to stop."
npm start
