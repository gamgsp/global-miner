#!/usr/bin/env bash
# Global Miner - Linux Systemd Service Installer
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Installing Global Miner systemd service..."
node cli/autoStart.js install
