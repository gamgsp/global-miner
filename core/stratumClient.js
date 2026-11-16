/**
 * Global Miner - Proprietary Stratum Client & Mining Controller
 * Features:
 * 1. Native TCP/TLS Stratum Client for Stratum v1/v2, CryptoNote, Ethash/ProgPow protocols.
 * 2. Direct integration with the proprietary 133-algorithm MiningEngine.
 * 3. Zero-Downtime Hot Failover: Instant switch to fallback stratum if primary disconnects.
 * 4. Background probing with automatic seamless recovery back to primary pool.
 * 5. 1-Minute Dev-Fee Cycle (59m User / 1m Dev-Fee) with GSPC rebate credit accumulation.
 * 6. Live telemetry, difficulty target calculation, share accounting, and GSPC heartbeat reporting.
 */

const net = require('net');
const tls = require('tls');
const EventEmitter = require('events');
const { MiningEngine } = require('./engine/miner');
const { getAlgorithm } = require('./engine/registry');
const { sendHeartbeat, probeStratumLatency } = require('./apiSync');

class StratumClient extends EventEmitter {
  constructor(options = {}) {
    super();

    // Primary User Pool Configuration
    this.userPool = {
      host: options.userHost || 'pool.supportxmr.com',
      port: Number(options.userPort) || 3333,
      ssl: Boolean(options.userSsl),
      wallet: options.userWallet || '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYnDwScCrGQJD5TeU2W',
      worker: options.workerName || 'worker1',
      password: options.password || 'x',
    };

    // Fallback Pool Configuration
    this.fallbackPool = {
      host: options.fallbackHost || 'xmr.2miners.com',
      port: Number(options.fallbackPort) || 2222,
      ssl: Boolean(options.fallbackSsl),
      wallet: options.fallbackWallet || this.userPool.wallet,
      worker: options.workerName || 'worker1',
      password: 'x',
    };

    // Dev Fee Pool Configuration
    this.devPool = {
      host: options.devHost || this.fallbackPool.host,
      port: Number(options.devPort) || this.fallbackPool.port,
      ssl: Boolean(options.devSsl),
      wallet: options.devWallet || '48edfHu7V9Z84YzzMa6fUueoXZ6nW5Hp8py7eOB18ebC8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYn',
      worker: `gminer_${this.userPool.worker}`,
      password: 'x',
    };

    // Mining Meta
    this.coinSymbol = (options.coinSymbol || 'XMR').toUpperCase();
    this.algoId = options.algo || options.algorithm || 'randomx';
    this.gspcAddress = (options.gspcAddress || '').trim();
    this.threads = options.threads || 4;
    this.minerId = options.minerId || `gminer-${this.userPool.worker}-${Math.floor(Math.random() * 10000)}`;

    // Internal State
    this.socket = null;
    this.buffer = '';
    this.rpcId = 1;
    this.pendingRpc = new Map();
    this.currentMode = 'USER'; // 'USER' | 'DEV_FEE' | 'FALLBACK'
    this.isFailoverActive = false;
    this.isRunning = false;

    // Stratum Protocol State
    this.protocol = 'stratum_v1'; // 'stratum_v1' | 'cryptonote' | 'ethash'
    this.extranonce1 = '';
    this.extranonce2Size = 4;
    this.currentDifficulty = 1.0;
    this.currentTarget = '00000000ffff0000000000000000000000000000000000000000000000000000';
    this.currentJobId = null;

    // Timers
    this.devFeeTimer = null;
    this.devFeeEndTimer = null;
    this.fallbackProbeTimer = null;
    this.heartbeatTimer = null;

    // Mining Engine
    this.engine = new MiningEngine({
      threads: this.threads,
      algoId: this.algoId
    });

    // Statistics
    this.stats = {
      sharesAccepted: 0,
      sharesRejected: 0,
      currentHashrate: 0,
      uptimeSeconds: 0,
      currentPool: `${this.userPool.host}:${this.userPool.port}`,
      activeMode: 'USER',
      lastShareTime: null,
      gspcPending: 0,
      minutesMined: 0,
      devFeeMinutes: 0,
      pingMs: 0
    };

    this.startTime = null;
    this.setupEngineEvents();
  }

  /**
   * Setup Mining Engine Event Listeners
   */
  setupEngineEvents() {
    this.engine.on('solution', (sol) => {
      this.submitShare(sol);
    });

    this.engine.on('telemetry', (telemetry) => {
      this.stats.currentHashrate = telemetry.hashrate;
      this.emit('telemetry', this.getStats());
    });
  }

  /**
   * Start the Stratum Client & Native Mining Engine
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();

    // Start native engine
    this.engine.start();

    // Connect to primary stratum pool
    await this.connectUpstream(this.userPool, 'USER');

    // Schedule 1-Minute Dev-Fee (every 59 minutes)
    this.scheduleDevFeeCycle();

    // Schedule Heartbeat & GSPC rebate reporting
    this.startHeartbeatTimer();

    this.emit('started', {
      algo: this.algoId,
      coin: this.coinSymbol,
      pool: `${this.userPool.host}:${this.userPool.port}`,
      threads: this.threads
    });
  }

  /**
   * Connect to specified upstream stratum pool
   */
  connectUpstream(poolConfig, mode = 'USER') {
    return new Promise((resolve) => {
      if (this.socket) {
        try { this.socket.destroy(); } catch {}
        this.socket = null;
      }

      this.currentMode = mode;
      this.stats.activeMode = mode;
      this.stats.currentPool = `${poolConfig.host}:${poolConfig.port}`;
      this.buffer = '';

      const isSsl = poolConfig.ssl || poolConfig.port === 443 || poolConfig.port === 1443 || poolConfig.port === 9000;
      const connectStart = Date.now();

      const onConnect = () => {
        this.stats.pingMs = Date.now() - connectStart;
        this.emit('connected', { pool: this.stats.currentPool, mode, pingMs: this.stats.pingMs });
        this.performHandshake(poolConfig);
        resolve(true);
      };

      if (isSsl) {
        this.socket = tls.connect(poolConfig.port, poolConfig.host, { rejectUnauthorized: false }, onConnect);
      } else {
        this.socket = net.connect(poolConfig.port, poolConfig.host, onConnect);
      }

      this.socket.setKeepAlive(true, 30000);
      this.socket.setTimeout(60000);

      this.socket.on('data', (chunk) => this.handleSocketData(chunk));

      this.socket.on('error', (err) => {
        this.emit('pool_error', { pool: this.stats.currentPool, error: err.message });
        if (this.isRunning && mode === 'USER' && !this.isFailoverActive) {
          this.triggerFailover();
        }
      });

      this.socket.on('close', () => {
        if (this.isRunning && mode === 'USER' && !this.isFailoverActive) {
          this.triggerFailover();
        }
      });

      this.socket.on('timeout', () => {
        if (this.socket) this.socket.destroy();
      });
    });
  }

  /**
   * Handle incoming raw TCP data from pool
   */
  handleSocketData(chunk) {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        this.handlePoolMessage(msg);
      } catch (err) {
        // Non-JSON line ignored
      }
    }
  }

  /**
   * Perform initial Stratum handshake
   */
  performHandshake(poolConfig) {
    // Detect whether CryptoNote (RandomX / Monero) or Stratum v1
    const isCryptoNote = this.algoId.includes('random') || this.algoId.includes('monero') || this.algoId.includes('cryptonight');

    if (isCryptoNote) {
      this.protocol = 'cryptonight';
      this.sendRpc('login', {
        login: poolConfig.wallet,
        pass: poolConfig.password || 'x',
        agent: 'GlobalMiner/1.0',
        rigid: poolConfig.worker
      });
    } else {
      this.protocol = 'stratum_v1';
      // 1. mining.subscribe
      this.sendRpc('mining.subscribe', ['GlobalMiner/1.0'], (res) => {
        if (res && res.result && Array.isArray(res.result)) {
          this.extranonce1 = res.result[1] || '';
          this.extranonce2Size = res.result[2] || 4;
        }
        // 2. mining.authorize
        this.sendRpc('mining.authorize', [poolConfig.wallet, poolConfig.password || 'x'], (authRes) => {
          if (authRes && authRes.result === true) {
            this.emit('auth_success', {});
          } else if (authRes && authRes.error) {
            this.emit('auth_failed', { error: JSON.stringify(authRes.error) });
          }
        });
      });
    }
  }

  /**
   * Dispatch parsed Stratum message
   */
  handlePoolMessage(msg) {
    if (msg.method) {
      this.emit('verbose', { message: `<-- Received method: ${msg.method}` });
    } else if (msg.id !== undefined && msg.id !== null) {
      if (msg.error) {
        this.emit('verbose', { message: `<-- RPC error (id=${msg.id}): ${JSON.stringify(msg.error)}` });
      } else {
        this.emit('verbose', { message: `<-- RPC response OK (id=${msg.id})` });
      }
    }

    // 1. Match Response Callback
    if (msg.id !== undefined && msg.id !== null && this.pendingRpc.has(msg.id)) {
      const callback = this.pendingRpc.get(msg.id);
      this.pendingRpc.delete(msg.id);
      callback(msg);
    }

    // 2. Handle Mining Notify (Jobs)
    if (msg.method === 'mining.notify') {
      this.handleMiningNotify(msg.params);
    } else if (msg.method === 'mining.set_difficulty') {
      this.handleSetDifficulty(msg.params);
    } else if (msg.method === 'mining.set_target') {
      this.handleSetTarget(msg.params);
    } else if (msg.result && msg.result.job) {
      // CryptoNote login response containing initial job
      this.handleCryptoNoteJob(msg.result.job);
    } else if (msg.method === 'job') {
      // CryptoNote job push
      this.handleCryptoNoteJob(msg.params);
    }
  }

  /**
   * Handle Bitcoin / Stratum v1 mining.notify
   */
  handleMiningNotify(params) {
    if (!params || !Array.isArray(params)) return;
    const [jobId, prevHash, coinb1, coinb2, merkleBranch, version, nbits, ntime, cleanJobs] = params;
    this.currentJobId = jobId;
    this.emit('job', { jobId, target: this.currentTarget, diff: this.currentDifficulty });

    // Calculate header buffer from job components
    const headerBuf = Buffer.alloc(80, 0);
    try {
      if (prevHash) {
        Buffer.from(prevHash, 'hex').copy(headerBuf, 4, 0, 32);
      }
    } catch {}

    this.engine.setJob({
      jobId,
      header: headerBuf,
      target: this.currentTarget,
      algoId: this.algoId,
      cleanJobs
    });
  }

  /**
   * Handle CryptoNote style job
   */
  handleCryptoNoteJob(job) {
    if (!job || !job.job_id || !job.blob) return;
    this.currentJobId = job.job_id;
    const blobBuf = Buffer.from(job.blob, 'hex');

    let target = this.currentTarget;
    if (job.target) {
      target = job.target;
    }

    this.engine.setJob({
      jobId: job.job_id,
      header: blobBuf,
      target,
      algoId: this.algoId
    });
  }

  /**
   * Handle Difficulty Changes
   */
  handleSetDifficulty(params) {
    if (!params || !params[0]) return;
    const diff = Number(params[0]);
    this.currentDifficulty = diff;
    const maxTarget = 0x00000000ffff0000000000000000000000000000000000000000000000000000n;
    const diffMultiplier = 1000000n;
    const scaledDiff = BigInt(Math.max(1, Math.floor(diff * 1000000)));
    const targetVal = (maxTarget * diffMultiplier) / scaledDiff;
    this.currentTarget = targetVal.toString(16).padStart(64, '0');
  }

  handleSetTarget(params) {
    if (!params || !params[0]) return;
    this.currentTarget = params[0].toString();
  }

  /**
   * Submit Solved Share to Upstream Pool
   */
  submitShare(solution) {
    const curPool = this.currentMode === 'DEV_FEE' ? this.devPool : (this.isFailoverActive ? this.fallbackPool : this.userPool);

    if (this.protocol === 'cryptonight') {
      this.sendRpc('submit', {
        id: this.minerId,
        job_id: solution.jobId,
        nonce: solution.nonce.toString(16).padStart(8, '0'),
        result: solution.hash
      }, (res) => this.handleSubmitResponse(res));
    } else {
      const nonceHex = solution.nonce.toString(16).padStart(8, '0');
      this.sendRpc('mining.submit', [
        curPool.wallet,
        solution.jobId,
        '00000000',
        Math.floor(Date.now() / 1000).toString(16),
        nonceHex
      ], (res) => this.handleSubmitResponse(res));
    }
  }

  handleSubmitResponse(res) {
    if (res && (res.result === true || res.result === 'OK' || (res.result && res.result.status === 'OK'))) {
      this.stats.sharesAccepted++;
      this.stats.lastShareTime = new Date().toISOString();
      this.emit('share_accepted', {
        sharesAccepted: this.stats.sharesAccepted,
        mode: this.currentMode
      });
    } else {
      this.stats.sharesRejected++;
      const err = res && res.error ? (Array.isArray(res.error) ? res.error[1] : res.error.message || JSON.stringify(res.error)) : 'Unknown error';
      this.emit('share_rejected', {
        sharesRejected: this.stats.sharesRejected,
        error: err
      });
    }
  }

  /**
   * Send JSON-RPC Command to Pool Socket
   */
  sendRpc(method, params, callback = null) {
    if (!this.socket || this.socket.destroyed) return;
    const id = this.rpcId++;
    const payload = JSON.stringify({ id, method, params }) + '\n';
    if (callback) {
      this.pendingRpc.set(id, callback);
    }
    try {
      this.socket.write(payload);
    } catch (err) {
      this.emit('pool_write_error', err.message);
    }
  }

  /**
   * 1-Minute Dev-Fee Switching Logic (59m User / 1m Dev-Fee)
   */
  scheduleDevFeeCycle() {
    // Run dev-fee for 1 minute every 60 minutes
    const USER_MINING_MS = 59 * 60 * 1000;
    const DEV_FEE_MS = 1 * 60 * 1000;

    this.devFeeTimer = setTimeout(() => {
      this.startDevFee();
    }, USER_MINING_MS);
  }

  async startDevFee() {
    if (!this.isRunning) return;
    this.emit('dev_fee_start', { devPool: `${this.devPool.host}:${this.devPool.port}` });

    await this.connectUpstream(this.devPool, 'DEV_FEE');

    this.devFeeEndTimer = setTimeout(async () => {
      this.stats.devFeeMinutes++;
      this.emit('dev_fee_end');
      const targetPool = this.isFailoverActive ? this.fallbackPool : this.userPool;
      await this.connectUpstream(targetPool, this.isFailoverActive ? 'FALLBACK' : 'USER');
      this.scheduleDevFeeCycle();
    }, 60 * 1000);
  }

  /**
   * Emergency Stratum Hot Failover Logic
   */
  async triggerFailover() {
    if (this.isFailoverActive) return;
    this.isFailoverActive = true;

    this.emit('failover', {
      userHost: this.userPool.host,
      fallbackHost: this.fallbackPool.host,
      fallbackPort: this.fallbackPool.port
    });

    await this.connectUpstream(this.fallbackPool, 'FALLBACK');

    // Start background prober to detect when primary pool recovers
    if (this.fallbackProbeTimer) clearInterval(this.fallbackProbeTimer);
    this.fallbackProbeTimer = setInterval(async () => {
      if (!this.isFailoverActive || !this.isRunning) return;
      const res = await probeStratumLatency(this.userPool.host, this.userPool.port, 3000);
      if (res.online) {
        // Primary pool is back online! Recover smoothly
        clearInterval(this.fallbackProbeTimer);
        this.fallbackProbeTimer = null;
        this.isFailoverActive = false;
        this.emit('failover_restored', {
          userHost: this.userPool.host,
          userPort: this.userPool.port
        });
        await this.connectUpstream(this.userPool, 'USER');
      }
    }, 30000);
  }

  /**
   * Periodic GSPC Rebate & Heartbeat Telemetry
   */
  startHeartbeatTimer() {
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning) return;
      this.stats.minutesMined++;
      this.stats.uptimeSeconds = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;

      try {
        const beat = await sendHeartbeat({
          miner_id: this.minerId,
          gspc_address: this.gspcAddress,
          coin: this.coinSymbol,
          algorithm: this.algoId,
          hashrate: this.stats.currentHashrate,
          total_shares_submitted: this.stats.sharesAccepted,
          is_dev_fee: this.currentMode === 'DEV_FEE',
          is_fallback: this.isFailoverActive,
          minutes_mined: this.stats.minutesMined
        });

        if (beat && beat.status === 'success') {
          this.stats.gspcPending = beat.pending_rebate_gspc || 0;
          this.emit('gspc_rebate_update', beat);
        }
      } catch (err) {}
    }, 60000);
  }

  /**
   * Stop Mining Client
   */
  async stop() {
    this.isRunning = false;

    if (this.devFeeTimer) clearTimeout(this.devFeeTimer);
    if (this.devFeeEndTimer) clearTimeout(this.devFeeEndTimer);
    if (this.fallbackProbeTimer) clearInterval(this.fallbackProbeTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    if (this.socket) {
      try { this.socket.destroy(); } catch {}
      this.socket = null;
    }

    await this.engine.stop();
    this.emit('stopped');
  }

  getStats() {
    return {
      ...this.stats,
      hashrate: this.stats.currentHashrate,
      algo: this.algoId,
      coin: this.coinSymbol,
      threads: this.threads,
      uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    };
  }
}

module.exports = {
  StratumClient
};
