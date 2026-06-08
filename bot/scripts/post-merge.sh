#!/bin/bash
set -e

echo "[POST-MERGE] Running DLavie OS post-merge setup..."

echo "[POST-MERGE] Installing npm dependencies..."
npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -5

echo "[POST-MERGE] Done."
