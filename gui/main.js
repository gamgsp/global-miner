/**
 * Global Miner - Desktop GUI Main Process (Electron)
 * Direct integration with proprietary StratumClient & 133-Algorithm Mining Engine
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { detectHardware } = require('../core/hardware');
const { fetchMetadata, getRebates } = require('../core/apiSync');
const { StratumClient } = require('../core/stratumClient');
const { installService, uninstallService, checkServiceStatus } = require('../cli/autoStart');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let mainWindow = null;
let activeClient = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#0b0f19',
    title: 'Global Miner - Proprietary 133-Algorithm Universal Mining Client',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopActiveClient();
  });
}

async function stopActiveClient() {
  if (activeClient) {
    try { await activeClient.stop(); } catch {}
    activeClient = null;
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
  stopActiveClient();
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
    await stopActiveClient();

    activeClient = new StratumClient({
      userHost: config.userHost,
      userPort: config.userPort,
      userWallet: config.walletAddress,
      workerName: config.workerName || 'gui_worker',
      fallbackHost: config.fallbackHost,
      fallbackPort: config.fallbackPort,
      coinSymbol: config.coin,
      algo: config.algorithm,
      threads: config.threads || 4,
      gspcAddress: config.gspcAddress,
    });

    // Forward StratumClient events to GUI renderer
    const forwardEvent = (type, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mining-event', {
          type,
          data,
          stats: activeClient ? activeClient.getStats() : null
        });
      }
    };

    activeClient.on('started', (info) => forwardEvent('started', info));
    activeClient.on('connected', (info) => forwardEvent('connected', info));
    activeClient.on('failover', (info) => forwardEvent('failover', info));
    activeClient.on('failover_restored', (info) => forwardEvent('failover_restored', info));
    activeClient.on('dev_fee_start', (info) => forwardEvent('dev_fee_start', info));
    activeClient.on('dev_fee_end', () => forwardEvent('dev_fee_end', {}));
    activeClient.on('share_accepted', (info) => forwardEvent('share_accepted', info));
    activeClient.on('share_rejected', (info) => forwardEvent('share_rejected', info));
    activeClient.on('telemetry', (stats) => forwardEvent('tick', { hashrate: stats.hashrate, stats }));
    activeClient.on('gspc_rebate_update', (rebate) => forwardEvent('rebate_update', rebate));

    await activeClient.start();

    return { success: true };
  });

  ipcMain.handle('stop-mining', async () => {
    await stopActiveClient();
    return { success: true };
  });
}
