#!/usr/bin/env node
/**
 * Global Miner - Cross-Platform Build Master Runner
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('====================================================');
console.log('  GLOBAL MINER - CROSS-PLATFORM BUILD ORCHESTRATOR  ');
console.log('====================================================\n');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function runStep(label, cmd) {
  console.log(`\n>>> Running: ${label}...`);
  try {
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`✓ ${label}: SUCCESS`);
  } catch (err) {
    console.error(`✗ ${label}: FAILED (${err.message})`);
  }
}

// 1. Linux Packaging
runStep('Linux Build (.deb & .AppImage)', 'bash build-scripts/build-linux.sh');

// 2. Windows Packaging
runStep('Windows Build (Zip & Launcher)', 'bash build-scripts/build-windows.sh');

// 3. macOS Packaging
runStep('macOS Build (.app & .dmg)', 'bash build-scripts/build-mac.sh');

console.log('\n====================================================');
console.log('  BUILD ARTIFACTS GENERATED IN: dist/               ');
console.log('====================================================');
if (fs.existsSync(DIST_DIR)) {
  const files = fs.readdirSync(DIST_DIR);
  files.forEach(f => console.log(`  • dist/${f}`));
}
console.log('');
