#!/usr/bin/env bash
# Global Miner - Linux Systemd Service Uninstaller
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Uninstalling Global Miner systemd service..."
node cli/autoStart.js uninstall
