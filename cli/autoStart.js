/**
 * Global Miner - Cross-Platform Auto-Start Service Manager
 * 
 * Supports:
 * - Linux: systemd system or user service (globalminer.service)
 * - Windows: Windows Task Scheduler & Startup registration
 * - macOS: launchd LaunchAgent (~/Library/LaunchAgents/com.globalminer.plist)
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_DIR = path.resolve(__dirname, '..');
const CLI_PATH = path.join(APP_DIR, 'cli', 'index.js');
const NODE_BIN = process.execPath; // Path to current node binary

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return (err.stderr || err.message || '').trim();
  }
}

/**
 * LINUX: Systemd Installer
 */
function installLinuxService() {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  let servicePath;
  let isUserService = false;

  if (isRoot) {
    servicePath = '/etc/systemd/system/globalminer.service';
  } else {
    // Install in user systemd directory
    isUserService = true;
    const userSystemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    fs.mkdirSync(userSystemdDir, { recursive: true });
    servicePath = path.join(userSystemdDir, 'globalminer.service');
  }

  const unitContent = `[Unit]
Description=Global Miner Universal Background Mining Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} ${CLI_PATH} --daemon
Restart=always
RestartSec=10
StandardOutput=append:${path.join(APP_DIR, 'miner.log')}
StandardError=append:${path.join(APP_DIR, 'miner_error.log')}
Environment=NODE_ENV=production

[Install]
WantedBy=${isUserService ? 'default.target' : 'multi-user.target'}
`;

  fs.writeFileSync(servicePath, unitContent, 'utf8');

  const cmdPrefix = isUserService ? 'systemctl --user' : 'systemctl';
  safeExec(`${cmdPrefix} daemon-reload`);
  safeExec(`${cmdPrefix} enable globalminer.service`);
  safeExec(`${cmdPrefix} restart globalminer.service`);

  return {
    success: true,
    platform: 'linux',
    mode: isUserService ? 'user_service' : 'system_service',
    servicePath,
    message: `Linux systemd service installed and started (${servicePath})`,
  };
}

function uninstallLinuxService() {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const userPath = path.join(os.homedir(), '.config', 'systemd', 'user', 'globalminer.service');
  const sysPath = '/etc/systemd/system/globalminer.service';

  if (fs.existsSync(userPath)) {
    safeExec('systemctl --user stop globalminer.service');
    safeExec('systemctl --user disable globalminer.service');
    fs.unlinkSync(userPath);
    safeExec('systemctl --user daemon-reload');
    return { success: true, message: 'Removed user systemd service' };
  }

  if (fs.existsSync(sysPath)) {
    if (!isRoot) return { success: false, message: 'Root/sudo permissions required to remove /etc/systemd/system/globalminer.service' };
    safeExec('systemctl stop globalminer.service');
    safeExec('systemctl disable globalminer.service');
    fs.unlinkSync(sysPath);
    safeExec('systemctl daemon-reload');
    return { success: true, message: 'Removed system systemd service' };
  }

  return { success: false, message: 'No active Linux systemd service found' };
}

/**
 * WINDOWS: Task Scheduler & Startup Helper
 */
function installWindowsService() {
  const vbsPath = path.join(APP_DIR, 'windows', 'start_hidden.vbs');
  const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run """${NODE_BIN}"" """${CLI_PATH}""" --daemon", 0, False\r\n`;
  fs.mkdirSync(path.dirname(vbsPath), { recursive: true });
  fs.writeFileSync(vbsPath, vbsContent, 'utf8');

  // 1. Try Windows Task Scheduler
  const taskCmd = `schtasks /Create /TN "GlobalMiner" /TR "wscript.exe \\"${vbsPath}\\"" /SC ONLOGON /RL HIGHEST /F`;
  const taskOut = safeExec(taskCmd);

  // 2. Also register in Windows Startup folder for guaranteed resilience
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const startupBat = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'globalminer_autostart.bat');
  try {
    fs.mkdirSync(path.dirname(startupBat), { recursive: true });
    fs.writeFileSync(startupBat, `@echo off\r\nstart /b "" wscript.exe "${vbsPath}"\r\n`, 'utf8');
  } catch (err) {
    // ignore
  }

  return {
    success: true,
    platform: 'win32',
    vbsPath,
    startupBat,
    details: taskOut,
    message: 'Windows auto-start scheduled task and startup runner created successfully',
  };
}

function uninstallWindowsService() {
  safeExec('schtasks /Delete /TN "GlobalMiner" /F');

  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const startupBat = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'globalminer_autostart.bat');
  if (fs.existsSync(startupBat)) {
    try { fs.unlinkSync(startupBat); } catch {}
  }

  return { success: true, message: 'Windows auto-start scheduled task and startup runner removed' };
}

/**
 * MACOS: LaunchAgent Plist Installer
 */
function installMacService() {
  const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  fs.mkdirSync(launchAgentsDir, { recursive: true });
  const plistPath = path.join(launchAgentsDir, 'com.globalminer.plist');

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.globalminer</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${CLI_PATH}</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(APP_DIR, 'miner.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(APP_DIR, 'miner_error.log')}</string>
    <key>WorkingDirectory</key>
    <string>${APP_DIR}</string>
</dict>
</plist>
`;

  fs.writeFileSync(plistPath, plistContent, 'utf8');

  safeExec(`launchctl unload "${plistPath}" 2>/dev/null || true`);
  safeExec(`launchctl load -w "${plistPath}"`);

  return {
    success: true,
    platform: 'darwin',
    plistPath,
    message: `macOS LaunchAgent installed and loaded (${plistPath})`,
  };
}

function uninstallMacService() {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.globalminer.plist');
  if (fs.existsSync(plistPath)) {
    safeExec(`launchctl unload "${plistPath}" 2>/dev/null || true`);
    try { fs.unlinkSync(plistPath); } catch {}
    return { success: true, message: 'macOS LaunchAgent unloaded and removed' };
  }
  return { success: false, message: 'No active macOS LaunchAgent found' };
}

/**
 * Universal Auto-Start Dispatcher
 */
function installService() {
  const platform = os.platform();
  if (platform === 'linux') return installLinuxService();
  if (platform === 'win32') return installWindowsService();
  if (platform === 'darwin') return installMacService();
  return { success: false, message: `Unsupported platform: ${platform}` };
}

function uninstallService() {
  const platform = os.platform();
  if (platform === 'linux') return uninstallLinuxService();
  if (platform === 'win32') return uninstallWindowsService();
  if (platform === 'darwin') return uninstallMacService();
  return { success: false, message: `Unsupported platform: ${platform}` };
}

function checkServiceStatus() {
  const platform = os.platform();
  let installed = false;
  let serviceFile = null;
  let running = false;

  if (platform === 'linux') {
    const userPath = path.join(os.homedir(), '.config', 'systemd', 'user', 'globalminer.service');
    const sysPath = '/etc/systemd/system/globalminer.service';
    if (fs.existsSync(userPath)) {
      installed = true;
      serviceFile = userPath;
      const status = safeExec('systemctl --user is-active globalminer.service');
      running = status.includes('active');
    } else if (fs.existsSync(sysPath)) {
      installed = true;
      serviceFile = sysPath;
      const status = safeExec('systemctl is-active globalminer.service');
      running = status.includes('active');
    }
  } else if (platform === 'win32') {
    const taskQuery = safeExec('schtasks /Query /TN "GlobalMiner"');
    installed = !taskQuery.includes('ERROR:');
    running = taskQuery.includes('Running');
  } else if (platform === 'darwin') {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.globalminer.plist');
    if (fs.existsSync(plistPath)) {
      installed = true;
      serviceFile = plistPath;
      const list = safeExec('launchctl list | grep com.globalminer');
      running = list.includes('com.globalminer');
    }
  }

  return { platform, installed, running, serviceFile };
}

// Standalone execution support
if (require.main === module) {
  const action = process.argv[2] || 'status';
  if (action === 'install') {
    console.log(installService());
  } else if (action === 'uninstall') {
    console.log(uninstallService());
  } else {
    console.log(checkServiceStatus());
  }
}

module.exports = {
  installService,
  uninstallService,
  checkServiceStatus,
};
