#!/usr/bin/env bash
# Global Miner - macOS LaunchAgent Uninstaller
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Uninstalling Global Miner LaunchAgent daemon..."
node cli/autoStart.js uninstall
