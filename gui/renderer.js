/**
 * Global Miner - GUI Renderer Process
 */

// State
let isMining = false;
let hardwareData = null;
let metadataData = null;
let chartHistory = [];
const MAX_CHART_POINTS = 35;
let uptimeSeconds = 0;
let uptimeTimer = null;

// DOM Elements
const cpuModelEl = document.getElementById('cpuModel');
const cpuThreadsEl = document.getElementById('cpuThreads');
const cpuL3El = document.getElementById('cpuL3');
const gpuModelEl = document.getElementById('gpuModel');
const gpuVramEl = document.getElementById('gpuVram');
const gpuDriverEl = document.getElementById('gpuDriver');
const ramTotalEl = document.getElementById('ramTotal');
const ramFreeEl = document.getElementById('ramFree');
const recTargetEl = document.getElementById('recTarget');
const osBadgeEl = document.getElementById('osBadge');

const hashrateDisplayEl = document.getElementById('hashrateDisplay');
const sharesAcceptedDisplayEl = document.getElementById('sharesAcceptedDisplay');
const efficiencyDisplayEl = document.getElementById('efficiencyDisplay');
const uptimeTextEl = document.getElementById('uptimeText');

const failoverBannerEl = document.getElementById('failoverBanner');
const failoverStatusTextEl = document.getElementById('failoverStatusText');
const activePoolBadgeEl = document.getElementById('activePoolBadge');
const rebateAmountEl = document.getElementById('rebateAmount');

const algoSelectEl = document.getElementById('algoSelect');
const coinSelectEl = document.getElementById('coinSelect');
const poolSelectEl = document.getElementById('poolSelect');
const walletInputEl = document.getElementById('walletInput');
const workerInputEl = document.getElementById('workerInput');
const gspcInputEl = document.getElementById('gspcInput');
const miningBtnEl = document.getElementById('miningBtn');
const autoStartCheckboxEl = document.getElementById('autoStartCheckbox');
const consoleLogEl = document.getElementById('consoleLog');

const canvas = document.getElementById('hashrateChart');
const ctx = canvas.getContext('2d');

/**
 * Log message to bottom console
 */
function logToConsole(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  consoleLogEl.appendChild(line);
  consoleLogEl.scrollTop = consoleLogEl.scrollHeight;
}

/**
 * High-performance Canvas Line Chart for Real-time Hashrate
 */
function initCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height - 30;
  for (let i = 0; i < MAX_CHART_POINTS; i++) {
    chartHistory.push(0);
  }
  renderChart();
}

function updateChart(newVal) {
  chartHistory.push(newVal);
  if (chartHistory.length > MAX_CHART_POINTS) {
    chartHistory.shift();
  }
  renderChart();
}

function renderChart() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (chartHistory.length < 2) return;

  const maxVal = Math.max(...chartHistory, 100);
  const stepX = w / (MAX_CHART_POINTS - 1);

  // Draw Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += h / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw Path
  ctx.beginPath();
  for (let i = 0; i < chartHistory.length; i++) {
    const x = i * stepX;
    const y = h - (chartHistory[i] / maxVal) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw Gradient Area under curve
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fill();
}

/**
 * Format hashrate display
 */
function formatHashrate(rate) {
  if (rate >= 1e9) return `${(rate / 1e9).toFixed(2)} GH/s`;
  if (rate >= 1e6) return `${(rate / 1e6).toFixed(2)} MH/s`;
  if (rate >= 1e3) return `${(rate / 1e3).toFixed(2)} kH/s`;
  return `${rate.toFixed(0)} H/s`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `Uptime: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Initialize GUI on load
 */
async function initApp() {
  initCanvas();
  window.addEventListener('resize', initCanvas);

  logToConsole('Detecting hardware accelerators and CPU cache...', 'info');

  try {
    if (window.electronAPI) {
      hardwareData = await window.electronAPI.getHardware();
      metadataData = await window.electronAPI.getMetadata();
      const existingConfig = await window.electronAPI.getConfig();
      const serviceStatus = await window.electronAPI.getServiceStatus();

      populateHardwareUI(hardwareData);
      populateMetadataUI(metadataData, existingConfig);

      if (serviceStatus && serviceStatus.installed) {
        autoStartCheckboxEl.checked = true;
      }

      setupMiningEventListener();
    } else {
      logToConsole('Browser preview mode: using mocked API & hardware data', 'warn');
    }
  } catch (err) {
    logToConsole(`Initialization error: ${err.message}`, 'error');
  }
}

/**
 * Populate Hardware Telemetry Cards
 */
function populateHardwareUI(hw) {
  if (!hw) return;

  cpuModelEl.textContent = hw.cpu.model;
  cpuThreadsEl.textContent = `${hw.cpu.physicalCores} Cores / ${hw.cpu.logicalThreads} Threads`;
  cpuL3El.textContent = `${hw.cpu.l3CacheMb} MB (${hw.cpu.optimalRandomXThreads} Rec Threads)`;

  if (hw.gpus && hw.gpus.length > 0) {
    const primaryGpu = hw.gpus[0];
    gpuModelEl.textContent = primaryGpu.model;
    gpuVramEl.textContent = `${primaryGpu.vramGb} GB VRAM`;
    gpuDriverEl.textContent = primaryGpu.driverVersion || 'Active';
  } else {
    gpuModelEl.textContent = 'Integrated / None';
    gpuVramEl.textContent = '0 GB';
    gpuDriverEl.textContent = 'N/A';
  }

  ramTotalEl.textContent = `${hw.system.ram.totalGb} GB Total`;
  ramFreeEl.textContent = `${hw.system.ram.freeGb} GB Free`;

  if (hw.recommendations && hw.recommendations.length > 0) {
    recTargetEl.textContent = `${hw.recommendations[0].coin} (${hw.recommendations[0].algo})`;
  }

  osBadgeEl.textContent = `${hw.system.platform} ${hw.system.arch}`;
}

/**
 * Populate Form Dropdowns with Dynamic API Metadata
 */
function populateMetadataUI(metadata, existingConfig) {
  if (!metadata) return;

  // 1. Algorithms grouped by Family
  algoSelectEl.innerHTML = '';
  
  // Categorize algorithms
  const familyMap = new Map();
  metadata.algorithms.forEach(algo => {
    const fam = algo.family || (algo.hardware_target === 'cpu' ? 'CPU Mining Algorithms' : 'GPU Mining Algorithms');
    if (!familyMap.has(fam)) familyMap.set(fam, []);
    familyMap.get(fam).push(algo);
  });

  familyMap.forEach((algos, familyName) => {
    const group = document.createElement('optgroup');
    group.label = familyName;
    algos.forEach(algo => {
      const opt = document.createElement('option');
      opt.value = algo.id;
      opt.textContent = `${algo.name} [${(algo.hardware_target || 'CPU').toUpperCase()}]`;
      group.appendChild(opt);
    });
    algoSelectEl.appendChild(group);
  });

  // 2. Event Listeners for dependent selects
  algoSelectEl.addEventListener('change', () => {
    updateCoinSelect(metadata);
  });

  coinSelectEl.addEventListener('change', () => {
    updatePoolSelect(metadata);
  });

  // Select defaults or existing
  if (existingConfig && existingConfig.algorithm) {
    algoSelectEl.value = existingConfig.algorithm;
  }
  updateCoinSelect(metadata, existingConfig);

  // Set Inputs
  if (existingConfig) {
    if (existingConfig.walletAddress) walletInputEl.value = existingConfig.walletAddress;
    if (existingConfig.workerName) workerInputEl.value = existingConfig.workerName;
    if (existingConfig.gspcAddress) {
      gspcInputEl.value = existingConfig.gspcAddress;
      pollRebates(existingConfig.gspcAddress);
    }
  } else {
    walletInputEl.value = '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYnDwScCrGQJD5TeU2W';
    workerInputEl.value = 'rig_desktop';
    gspcInputEl.value = 'GaMDevMiningRebateWalletAddress123';
  }
}

function updateCoinSelect(metadata, existingConfig) {
  const selectedAlgo = algoSelectEl.value;
  const matched = metadata.coins.filter(c => c.algorithm_id === selectedAlgo);
  const coins = matched.length > 0 ? matched : metadata.coins;

  coinSelectEl.innerHTML = '';
  coins.forEach(coin => {
    const opt = document.createElement('option');
    opt.value = coin.symbol;
    opt.textContent = `${coin.symbol} - ${coin.name}`;
    coinSelectEl.appendChild(opt);
  });

  if (existingConfig && existingConfig.coin) {
    coinSelectEl.value = existingConfig.coin;
  }
  updatePoolSelect(metadata, existingConfig);
}

function updatePoolSelect(metadata, existingConfig) {
  const selectedCoinSymbol = coinSelectEl.value;
  const coinObj = metadata.coins.find(c => c.symbol === selectedCoinSymbol);
  const coinId = coinObj ? coinObj.id : null;

  const matched = metadata.pools.filter(p => p.coin_id === coinId);
  const pools = matched.length > 0 ? matched : metadata.pools;

  poolSelectEl.innerHTML = '';
  pools.forEach(pool => {
    const opt = document.createElement('option');
    opt.value = `${pool.stratum_host}:${pool.stratum_port}`;
    opt.textContent = `${pool.pool_name} (${pool.stratum_host}:${pool.stratum_port}) [${pool.ping_ms || 50}ms]`;
    opt.dataset.host = pool.stratum_host;
    opt.dataset.port = pool.stratum_port;
    opt.dataset.region = pool.region;
    poolSelectEl.appendChild(opt);
  });

  activePoolBadgeEl.textContent = poolSelectEl.value;
}

/**
 * Handle Mining Events from Electron Main IPC
 */
function setupMiningEventListener() {
  window.electronAPI.onMiningEvent((event) => {
    const { type, data, stats } = event;

    if (type === 'tick' && data && data.hashrate !== undefined) {
      hashrateDisplayEl.textContent = formatHashrate(data.hashrate);
      updateChart(data.hashrate);
    }

    if (stats) {
      if (stats.sharesAccepted !== undefined) sharesAcceptedDisplayEl.textContent = stats.sharesAccepted;
      if (stats.sharesAccepted > 0 || stats.sharesRejected > 0) {
        const total = stats.sharesAccepted + stats.sharesRejected;
        const eff = Math.round((stats.sharesAccepted / total) * 100);
        efficiencyDisplayEl.textContent = `${eff}%`;
      }
      if (stats.gspcPending !== undefined) {
        rebateAmountEl.textContent = `${stats.gspcPending.toFixed(4)} GSPC`;
      }
    }

    // Stratum Failover Event Handling
    if (type === 'failover') {
      failoverBannerEl.className = 'failover-banner status-failover';
      failoverStatusTextEl.textContent = '⚡ EMERGENCY FAILOVER: Primary stratum disconnected! Routed to fallback.';
      activePoolBadgeEl.textContent = `${data.fallbackHost}:${data.fallbackPort} (Emergency Hot-Switch)`;
      logToConsole(`[FAILOVER ALERT] Upstream switched to emergency fallback pool ${data.fallbackHost}:${data.fallbackPort}`, 'error');
    } else if (type === 'failover_restored') {
      failoverBannerEl.className = 'failover-banner status-online';
      failoverStatusTextEl.textContent = '● Stratum Recovered: Reconnected to Primary User Pool';
      activePoolBadgeEl.textContent = `${data.userHost}:${data.userPort}`;
      logToConsole(`[STRATUM RESTORED] Primary pool back online. Seamlessly reverted!`, 'success');
    } else if (type === 'dev_fee_start') {
      failoverBannerEl.className = 'failover-banner status-devfee';
      failoverStatusTextEl.textContent = '★ DEV-FEE CYCLE: 1-minute rebate credit accumulation active';
      activePoolBadgeEl.textContent = `Dev-Fee Pool (GSPC Rebates Credit)`;
      logToConsole(`[DEV-FEE] 1-minute cycle started. User GSPC rebate credits recorded.`, 'warn');
    } else if (type === 'dev_fee_end') {
      failoverBannerEl.className = 'failover-banner status-online';
      failoverStatusTextEl.textContent = '● Stratum Upstream: Primary User Pool Connected';
      activePoolBadgeEl.textContent = poolSelectEl.value;
      logToConsole(`[DEV-FEE] Cycle complete. Upstream returned to user wallet.`, 'success');
    } else if (type === 'share_accepted') {
      logToConsole(`Share accepted #${data.sharesAccepted} [${data.mode}]`, 'success');
    } else if (type === 'share_rejected') {
      logToConsole(`Share rejected (${data.error})`, 'error');
    }
  });
}

/**
 * Poll GSPC Rebate Balance from Backend
 */
async function pollRebates(address) {
  if (!address || !window.electronAPI) return;
  try {
    const res = await window.electronAPI.getRebates(address);
    if (res && res.pending_rebate_gspc !== undefined) {
      rebateAmountEl.textContent = `${parseFloat(res.pending_rebate_gspc).toFixed(4)} GSPC`;
    }
  } catch {}
}

/**
 * Start / Stop Mining Toggle Button
 */
miningBtnEl.addEventListener('click', async () => {
  if (!isMining) {
    // Start Mining
    const selectedOption = poolSelectEl.options[poolSelectEl.selectedIndex];
    const userHost = selectedOption ? selectedOption.dataset.host : 'pool.supportxmr.com';
    const userPort = selectedOption ? parseInt(selectedOption.dataset.port, 10) : 3333;

    // Fallback selection
    const fallbackOption = poolSelectEl.options[poolSelectEl.selectedIndex === 0 ? 1 : 0];
    const fallbackHost = fallbackOption ? fallbackOption.dataset.host : 'xmr.2miners.com';
    const fallbackPort = fallbackOption ? parseInt(fallbackOption.dataset.port, 10) : 2222;

    const config = {
      algorithm: algoSelectEl.value,
      coin: coinSelectEl.value,
      userHost,
      userPort,
      fallbackHost,
      fallbackPort,
      walletAddress: walletInputEl.value.trim(),
      workerName: workerInputEl.value.trim() || 'desktop_rig',
      gspcAddress: gspcInputEl.value.trim(),
      localProxyPort: 19999,
    };

    if (window.electronAPI) {
      await window.electronAPI.saveConfig(config);
      await window.electronAPI.startMining(config);
    }

    isMining = true;
    miningBtnEl.textContent = 'STOP MINING';
    miningBtnEl.classList.add('btn-stop');

    logToConsole(`Proprietary Mining Engine active on ${config.coin} (${config.algorithm})`, 'success');
    logToConsole(`Connected directly to stratum+tcp://${config.userHost}:${config.userPort}`, 'info');

    uptimeSeconds = 0;
    uptimeTimer = setInterval(() => {
      uptimeSeconds++;
      uptimeTextEl.textContent = formatDuration(uptimeSeconds);
    }, 1000);

  } else {
    // Stop Mining
    if (window.electronAPI) {
      await window.electronAPI.stopMining();
    }

    isMining = false;
    miningBtnEl.textContent = 'START MINING';
    miningBtnEl.classList.remove('btn-stop');

    if (uptimeTimer) clearInterval(uptimeTimer);
    hashrateDisplayEl.textContent = '0.00 H/s';
    updateChart(0);

    logToConsole('Mining stopped. Hardware idled safely.', 'warn');
  }
});

/**
 * Auto-Start Toggle Listener
 */
autoStartCheckboxEl.addEventListener('change', async () => {
  if (!window.electronAPI) return;
  if (autoStartCheckboxEl.checked) {
    const res = await window.electronAPI.installService();
    logToConsole(res.message || 'Auto-start enabled', 'success');
  } else {
    const res = await window.electronAPI.uninstallService();
    logToConsole(res.message || 'Auto-start disabled', 'warn');
  }
});

// Boot UI
window.addEventListener('DOMContentLoaded', initApp);
