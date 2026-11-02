#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS version from https://nodejs.org/ then double-click this file again."
  read -n 1 -s -r -p "Press any key to close"
  exit 1
fi
node scripts/update.mjs
node scripts/launch.mjs
read -n 1 -s -r -p "DreamBinder stopped. Press any key to close"
