#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
TASK_RUNTIME="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node"
if command -v npx >/dev/null 2>&1; then
  FIREBASE_RUN=(npx --yes firebase-tools)
elif [ -x "$TASK_RUNTIME/bin/node" ] && [ -f "$TASK_RUNTIME/node_modules/pnpm/bin/pnpm.cjs" ]; then
  export PATH="$TASK_RUNTIME/bin:$PATH"
  FIREBASE_RUN=("$TASK_RUNTIME/bin/node" "$TASK_RUNTIME/node_modules/pnpm/bin/pnpm.cjs" dlx firebase-tools)
else
  echo "Előbb telepítsd a Node.js LTS változatát: https://nodejs.org/"
  read -r -p "Enter a bezáráshoz… "
  exit 1
fi
echo "Bejelentkezés a Firebase-projekt tulajdonosának Google-fiókjával."
"${FIREBASE_RUN[@]}" login
"${FIREBASE_RUN[@]}" deploy --only hosting,firestore:rules --project wortkarten-58af7
echo "Kész: https://wortkarten-58af7.web.app"
read -r -p "Enter a bezáráshoz… "
