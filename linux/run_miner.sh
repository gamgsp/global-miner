#!/usr/bin/env bash
# Global Miner - Linux Launcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Global Miner on Linux..."
if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is not installed. Please install Node.js (v18+) to run Global Miner."
    exit 1
fi

node cli/index.js "$@"
