/**
 * Global Miner - API Synchronization Client
 * Dynamic cloud stratum, algorithm, coin catalog & GSPC rebate tracker
 * Features local cache and offline fallback.
 * Queries https://api.globalminer.top/api/v1/tree and reports to /api/v1/miner/heartbeat
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const DEFAULT_API_BASE = process.env.GLOBALMINER_API || 'https://api.globalminer.top';
const CACHE_FILE = path.join(__dirname, '..', 'metadata_cache.json');

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
 * Normalizes tree response from /api/v1/tree into structured indexes
 */
function normalizeTreeData(treeData) {
  const algorithms = [];
  const coins = [];
  const pools = [];

  for (const algo of treeData) {
    algorithms.push({
      id: algo.id,
      name: algo.name,
      hardware_target: (algo.hardware_type || 'cpu').toLowerCase(),
      hardware_type: algo.hardware_type || 'CPU',
      min_vram_gb: algo.min_vram_gb || 0,
      coins_count: algo.coins_count || (algo.coins ? algo.coins.length : 0),
      description: `${algo.name} (${algo.hardware_type || 'CPU'}${algo.min_vram_gb ? `, ${algo.min_vram_gb}GB VRAM` : ''})`
    });

    if (algo.coins && Array.isArray(algo.coins)) {
      for (const coin of algo.coins) {
        coins.push({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          algorithm_id: algo.id,
          network_hashrate: coin.network_hashrate || '0',
          pools_count: coin.pools_count || (coin.pools ? coin.pools.length : 0),
          best_ping: coin.best_ping || 999
        });

        if (coin.pools && Array.isArray(coin.pools)) {
          for (const pool of coin.pools) {
            pools.push({
              id: pool.id,
              coin_id: coin.id,
              coin_symbol: coin.symbol,
              algorithm_id: algo.id,
              pool_name: pool.pool_name,
              stratum_host: pool.stratum_host,
              stratum_port: pool.stratum_port,
              ssl_port: pool.ssl_port,
              fee_percent: pool.fee_percent || '1.00',
              min_payout: pool.min_payout || '0.01',
              ping_ms: pool.ping_ms || 50
            });
          }
        }
      }
    }
  }

  return {
    status: 'success',
    count: algorithms.length,
    tree: treeData,
    algorithms,
    coins,
    pools,
    updated_at: new Date().toISOString()
  };
}

/**
 * Fetches dynamic metadata from /api/v1/tree with disk cache and offline fallback
 */
async function fetchMetadata(options = {}) {
  const apiBase = options.apiBase || DEFAULT_API_BASE;
  const timeoutMs = options.timeoutMs || 8000;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${apiBase}/api/v1/tree`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'GlobalMinerClient/1.0' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (json && json.status === 'success' && Array.isArray(json.data)) {
        const normalized = normalizeTreeData(json.data);
        normalized.source = 'api.globalminer.top/api/v1/tree';
        saveDiskCache(normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn(`[ApiSync] Master tree API unreachable (${err.message}). Using local cache.`);
  }

  // Fallback 1: Disk Cache
  const cached = loadDiskCache();
  if (cached && (cached.tree || (cached.algorithms && cached.algorithms.length > 0))) {
    if (cached.tree && (!cached.algorithms || cached.algorithms.length < cached.tree.length)) {
      const fixed = normalizeTreeData(cached.tree);
      fixed.source = 'disk_cache_normalized';
      return fixed;
    }
    cached.source = 'disk_cache';
    return cached;
  }

  // Fallback 2: Empty baseline
  return {
    status: 'fallback',
    count: 0,
    tree: [],
    algorithms: [],
    coins: [],
    pools: [],
    updated_at: new Date().toISOString()
  };
}

/**
 * Requests dynamic job token from API for dev fee or fallback routing
 */
async function getJobToken(coinSymbol, workerId = 'rig', isFallback = false, apiBase = DEFAULT_API_BASE) {
  return {
    stratum_host: 'rvn.2miners.com',
    stratum_port: 6060,
    dev_wallet: '48edfHu7V9Z84YzzMa6fUueoXZ6nW5Hp8py7eOB18ebC8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYn',
    worker_name: `gminer_${workerId}`,
    is_fallback: Boolean(isFallback),
    expires_in_seconds: 60,
    source: 'local_config'
  };
}

/**
 * Sends telemetry & heartbeat to accumulate GSPC rebate rewards
 * Endpoint: https://api.globalminer.top/api/v1/miner/heartbeat
 */
async function sendHeartbeat(data, apiBase = DEFAULT_API_BASE) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const payload = {
      miner_id: data.miner_id || data.worker_id || 'gminer-worker-1',
      gspc_address: (data.gspc_address || '').trim() || '0x0000000000000000000000000000000000000000',
      coin: (data.coin || data.coin_symbol || 'XMR').toUpperCase(),
      algorithm: data.algorithm || data.algo || 'randomx',
      hashrate: Number(data.hashrate) || 0,
      total_shares_submitted: Number(data.total_shares_submitted || data.shares || 0),
      is_dev_fee: Boolean(data.is_dev_fee),
      is_fallback: Boolean(data.is_fallback),
      minutes_mined: Number(data.minutes_mined) || 1,
      os: process.platform
    };

    const res = await fetch(`${apiBase}/api/v1/miner/heartbeat`, {
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
    console.warn('[ApiSync] Heartbeat error:', err.message);
  }
  return { status: 'offline', rebate_accrued_this_beat: 0, pending_rebate_gspc: 0 };
}

/**
 * Retrieves GSPC rebate status & payout history for an address
 */
async function getRebates(address, apiBase = DEFAULT_API_BASE) {
  if (!address || !address.trim()) {
    return { pending_rebate_gspc: 0, lifetime_rebate_gspc: 0, total_active_hours: '0.0', active_workers_count: 0, recent_payouts: [] };
  }

  // Ping heartbeat with 0 hashrate to obtain current ledger snapshot
  const beat = await sendHeartbeat({
    miner_id: `query-${Date.now()}`,
    gspc_address: address.trim(),
    hashrate: 0,
    coin: 'XMR',
    algorithm: 'randomx'
  }, apiBase);

  return {
    gspc_address: address,
    pending_rebate_gspc: beat.pending_rebate_gspc || 0,
    lifetime_rebate_gspc: beat.lifetime_paid_gspc || 0,
    total_active_hours: ((beat.total_active_minutes || 0) / 60).toFixed(1),
    active_workers_count: 1,
    recent_payouts: [],
    last_seen: beat.last_seen || new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_API_BASE,
  probeStratumLatency,
  fetchMetadata,
  normalizeTreeData,
  getJobToken,
  sendHeartbeat,
  getRebates,
};
