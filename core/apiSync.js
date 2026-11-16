/**
 * Global Miner - API Synchronization Client
 * Dynamic cloud stratum, algorithm, coin catalog & GSPC rebate tracker
 * Features local cache and offline fallback.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const DEFAULT_API_BASE = process.env.GLOBALMINER_API || 'https://api.globalminer.top';
const CACHE_FILE = path.join(__dirname, '..', 'metadata_cache.json');

// Hardcoded emergency offline fallback dataset
const OFFLINE_FALLBACK_METADATA = {
  algorithms: [
    { id: 'kawpow', name: 'KawPow', hardware_target: 'gpu', description: 'ASIC-resistant GPU algorithm for Ravencoin (min 4GB VRAM)' },
    { id: 'randomx', name: 'RandomX', hardware_target: 'cpu', description: 'CPU-optimized algorithm using random code execution for Monero' },
    { id: 'etchash', name: 'Etchash', hardware_target: 'gpu', description: 'Ethash variant modified for Ethereum Classic (min 4GB VRAM)' },
    { id: 'autolykos2', name: 'Autolykos2', hardware_target: 'gpu', description: 'Memory-hard GPU algorithm for Ergo (min 3GB VRAM)' },
    { id: 'ghostrider', name: 'GhostRider', hardware_target: 'cpu', description: 'Multi-algo cycling CPU algorithm for Raptoreum' }
  ],
  coins: [
    { id: 'rvn-kawpow', symbol: 'RVN', name: 'Ravencoin', algorithm_id: 'kawpow', min_vram_gb: '4.0', icon_url: 'https://cryptologos.cc/logos/ravencoin-rvn-logo.png' },
    { id: 'xmr-randomx', symbol: 'XMR', name: 'Monero', algorithm_id: 'randomx', min_vram_gb: '0.0', icon_url: 'https://cryptologos.cc/logos/monero-xmr-logo.png' },
    { id: 'etc-etchash', symbol: 'ETC', name: 'Ethereum Classic', algorithm_id: 'etchash', min_vram_gb: '4.0', icon_url: 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png' },
    { id: 'erg-autolykos2', symbol: 'ERG', name: 'Ergo', algorithm_id: 'autolykos2', min_vram_gb: '3.0', icon_url: 'https://cryptologos.cc/logos/ergo-erg-logo.png' },
    { id: 'rtm-ghostrider', symbol: 'RTM', name: 'Raptoreum', algorithm_id: 'ghostrider', min_vram_gb: '0.0', icon_url: 'https://cryptologos.cc/logos/raptoreum-rtm-logo.png' }
  ],
  pools: [
    { id: 1, coin_id: 'rvn-kawpow', pool_name: '2Miners', pool_url: 'https://2miners.com/rvn-mining-pool', fee_percent: '1.00', stratum_host: 'rvn.2miners.com', stratum_port: 6060, ssl_port: 16060, region: 'EU', ping_ms: 50, status: 'online' },
    { id: 2, coin_id: 'rvn-kawpow', pool_name: '2Miners US', pool_url: 'https://2miners.com/rvn-mining-pool', fee_percent: '1.00', stratum_host: 'us-rvn.2miners.com', stratum_port: 6060, ssl_port: 16060, region: 'US', ping_ms: 60, status: 'online' },
    { id: 3, coin_id: 'rvn-kawpow', pool_name: 'HeroMiners', pool_url: 'https://ravencoin.herominers.com', fee_percent: '0.90', stratum_host: 'ravencoin.herominers.com', stratum_port: 1140, ssl_port: 1141, region: 'GLOBAL', ping_ms: 55, status: 'online' },
    { id: 4, coin_id: 'xmr-randomx', pool_name: 'SupportXMR', pool_url: 'https://supportxmr.com', fee_percent: '0.60', stratum_host: 'pool.supportxmr.com', stratum_port: 3333, ssl_port: 9000, region: 'GLOBAL', ping_ms: 45, status: 'online' },
    { id: 5, coin_id: 'xmr-randomx', pool_name: '2Miners Monero', pool_url: 'https://2miners.com/xmr-mining-pool', fee_percent: '1.00', stratum_host: 'xmr.2miners.com', stratum_port: 2222, ssl_port: 12222, region: 'GLOBAL', ping_ms: 50, status: 'online' },
    { id: 6, coin_id: 'etc-etchash', pool_name: '2Miners ETC', pool_url: 'https://2miners.com/etc-mining-pool', fee_percent: '1.00', stratum_host: 'etc.2miners.com', stratum_port: 1010, ssl_port: 11010, region: 'GLOBAL', ping_ms: 50, status: 'online' },
    { id: 7, coin_id: 'erg-autolykos2', pool_name: 'HeroMiners ERG', pool_url: 'https://ergo.herominers.com', fee_percent: '0.90', stratum_host: 'ergo.herominers.com', stratum_port: 1180, ssl_port: 1181, region: 'GLOBAL', ping_ms: 55, status: 'online' }
  ],
  is_offline_fallback: true,
  updated_at: new Date().toISOString()
};

/**
 * Probes TCP ping latency to a stratum host
 */
function probeStratumLatency(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      const ping = Date.now() - start;
      socket.destroy();
      resolve({ online: true, pingMs: ping });
    });

    const onError = () => {
      socket.destroy();
      resolve({ online: false, pingMs: 9999 });
    };

    socket.on('error', onError);
    socket.on('timeout', onError);
  });
}

/**
 * Loads cached metadata from disk
 */
function loadDiskCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[ApiSync] Failed to read disk cache:', err.message);
  }
  return null;
}

/**
 * Saves metadata to disk cache
 */
function saveDiskCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ApiSync] Failed to write disk cache:', err.message);
  }
}

/**
 * Fetches dynamic metadata from master API with disk cache and offline fallback
 */
async function fetchMetadata(options = {}) {
  const apiBase = options.apiBase || DEFAULT_API_BASE;
  const timeoutMs = options.timeoutMs || 4000;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${apiBase}/api/v1/metadata`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'GlobalMinerClient/1.0' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.algorithms && data.coins && data.pools) {
        data.source = 'api.globalminer.top';
        saveDiskCache(data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`[ApiSync] Master API unreachable (${err.message}). Using local cache/fallback.`);
  }

  // Fallback 1: Disk Cache
  const cached = loadDiskCache();
  if (cached && cached.algorithms && cached.coins && cached.pools) {
    cached.source = 'disk_cache';
    return cached;
  }

  // Fallback 2: Built-in offline fallback
  return OFFLINE_FALLBACK_METADATA;
}

/**
 * Requests dynamic job token from API for dev fee or fallback routing
 */
async function getJobToken(coinSymbol, workerId = 'rig', isFallback = false, apiBase = DEFAULT_API_BASE) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiBase}/api/v1/job-token`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coin_symbol: coinSymbol, worker_id: workerId, is_fallback: isFallback })
    });
    clearTimeout(timeout);

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[ApiSync] Failed to fetch job token from API:', err.message);
  }

  // Fallback dev token if server is unreachable
  return {
    stratum_host: 'rvn.2miners.com',
    stratum_port: 6060,
    dev_wallet: 'RXK1SampleDevWalletForRavencoin',
    worker_name: `gminer_${workerId}`,
    is_fallback: Boolean(isFallback),
    expires_in_seconds: 60,
    source: 'local_fallback'
  };
}

/**
 * Sends telemetry & heartbeat to accumulate GSPC rebate rewards
 */
async function sendHeartbeat(data, apiBase = DEFAULT_API_BASE) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const payload = {
      worker_id: data.worker_id || 'rig',
      gspc_address: data.gspc_address || '',
      os: data.os || process.platform,
      coin_symbol: data.coin_symbol || 'RVN',
      algo: data.algo || 'kawpow',
      hashrate: data.hashrate || 0,
      minutes_mined: data.minutes_mined || 1,
      is_dev_fee: Boolean(data.is_dev_fee),
      is_fallback: Boolean(data.is_fallback),
    };

    const res = await fetch(`${apiBase}/api/v1/heartbeat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    clearTimeout(timeout);

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[ApiSync] Heartbeat transmission deferred:', err.message);
  }
  return { success: false };
}

/**
 * Retrieves GSPC rebate status & payout history for an address
 */
async function getRebates(address, apiBase = DEFAULT_API_BASE) {
  if (!address || !address.trim()) {
    return { pending_rebate_gspc: 0, lifetime_rebate_gspc: 0, total_active_hours: '0.0', active_workers_count: 0, recent_payouts: [] };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiBase}/api/v1/rebates/${encodeURIComponent(address.trim())}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[ApiSync] Failed to query rebates:', err.message);
  }

  return {
    gspc_address: address,
    pending_rebate_gspc: 0,
    lifetime_rebate_gspc: 0,
    total_active_hours: '0.0',
    active_workers_count: 0,
    recent_payouts: [],
    offline: true
  };
}

module.exports = {
  DEFAULT_API_BASE,
  OFFLINE_FALLBACK_METADATA,
  probeStratumLatency,
  fetchMetadata,
  getJobToken,
  sendHeartbeat,
  getRebates,
};
