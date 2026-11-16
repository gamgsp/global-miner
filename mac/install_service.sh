#!/usr/bin/env bash
# Global Miner - macOS LaunchAgent Installer
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Installing Global Miner LaunchAgent daemon..."
node cli/autoStart.js install
