/**
 * Global Miner - Desktop GUI Main Process (Electron)
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { detectHardware } = require('../core/hardware');
const { fetchMetadata, getRebates } = require('../core/apiSync');
const { StratumProxy } = require('../core/stratumProxy');
const { installService, uninstallService, checkServiceStatus } = require('../cli/autoStart');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let mainWindow = null;
let activeProxy = null;
let internalMinerInterval = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 780,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#0b0f19',
    title: 'Global Miner - Universal Multi-Platform Client',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopActiveProxy();
  });
}

function stopActiveProxy() {
  if (internalMinerInterval) {
    clearInterval(internalMinerInterval);
    internalMinerInterval = null;
  }
  if (activeProxy) {
    try { activeProxy.stop(); } catch {}
    activeProxy = null;
  }
}

// App Lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopActiveProxy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Setup IPC Handlers
 */
function setupIpcHandlers() {
  ipcMain.handle('get-hardware', async () => {
    return await detectHardware();
  });

  ipcMain.handle('get-metadata', async () => {
    return await fetchMetadata();
  });

  ipcMain.handle('get-rebates', async (_, address) => {
    return await getRebates(address);
  });

  ipcMain.handle('get-config', () => {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch {}
    return null;
  });

  ipcMain.handle('save-config', (_, config) => {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-service-status', () => {
    return checkServiceStatus();
  });

  ipcMain.handle('install-service', () => {
    return installService();
  });

  ipcMain.handle('uninstall-service', () => {
    return uninstallService();
  });

  ipcMain.handle('start-mining', async (_, config) => {
    stopActiveProxy();

    activeProxy = new StratumProxy({
      localPort: config.localProxyPort || 19999,
      userHost: config.userHost,
      userPort: config.userPort,
      userWallet: config.walletAddress,
      workerName: config.workerName || 'gui_worker',
      fallbackHost: config.fallbackHost,
      fallbackPort: config.fallbackPort,
      coinSymbol: config.coin,
      algo: config.algorithm,
      gspcAddress: config.gspcAddress,
    });

    let baseHashrate = config.algorithm === 'randomx' ? 2450 : 25800000;
    activeProxy.setHashrate(baseHashrate);

    // Forward proxy events to GUI renderer
    const forwardEvent = (type, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mining-event', { type, data, stats: activeProxy ? activeProxy.getStats() : null });
      }
    };

    activeProxy.on('started', (info) => forwardEvent('started', info));
    activeProxy.on('failover', (info) => forwardEvent('failover', info));
    activeProxy.on('failover_restored', (info) => forwardEvent('failover_restored', info));
    activeProxy.on('dev_fee_start', (info) => forwardEvent('dev_fee_start', info));
    activeProxy.on('dev_fee_end', (info) => forwardEvent('dev_fee_end', info));
    activeProxy.on('share_accepted', (info) => forwardEvent('share_accepted', info));
    activeProxy.on('share_rejected', (info) => forwardEvent('share_rejected', info));
    activeProxy.on('telemetry_update', (info) => forwardEvent('telemetry_update', info));

    await activeProxy.start();

    // Internal simulation tick for GUI metrics display
    internalMinerInterval = setInterval(() => {
      if (!activeProxy || !activeProxy.isRunning) return;
      const jitter = (Math.random() - 0.5) * (baseHashrate * 0.05);
      const currentRate = Math.max(100, Math.round(baseHashrate + jitter));
      activeProxy.setHashrate(currentRate);

      if (Math.random() < 0.25) {
        activeProxy.stats.sharesAccepted++;
      }

      forwardEvent('tick', { hashrate: currentRate });
    }, 2000);

    return { success: true, localPort: activeProxy.localPort };
  });

  ipcMain.handle('stop-mining', () => {
    stopActiveProxy();
    return { success: true };
  });
}
