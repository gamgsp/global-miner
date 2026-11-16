/**
 * Global Miner - Core Stratum Proxy & Failover Engine
 * 
 * Features:
 * 1. Local TCP Stratum Proxy bridging downstream miner to upstream pool
 * 2. Zero-Downtime Hot Failover: Instant switch to fallback stratum if primary disconnects
 * 3. Background probing of primary pool with automated seamless recovery
 * 4. 1-Minute Dev-Fee Switcher (59m User / 1m Dev Fee) with automated GSPC rebate credit logging
 * 5. Share accounting & live hashrate telemetry calculation
 */

const net = require('net');
const EventEmitter = require('events');
const { getJobToken, sendHeartbeat, probeStratumLatency } = require('./apiSync');

class StratumProxy extends EventEmitter {
  constructor(options = {}) {
    super();

    this.localPort = options.localPort || 19999;
    this.localHost = options.localHost || '127.0.0.1';

    // Primary User Pool Configuration
    this.userPool = {
      host: options.userHost || 'pool.supportxmr.com',
      port: options.userPort || 3333,
      wallet: options.userWallet || '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYnDwScCrGQJD5TeU2W',
      worker: options.workerName || 'worker1',
      password: options.password || 'x',
    };

    // Emergency Fallback Pool Configuration
    this.fallbackPool = {
      host: options.fallbackHost || 'xmr.2miners.com',
      port: options.fallbackPort || 2222,
      wallet: options.fallbackWallet || this.userPool.wallet,
      worker: options.workerName || 'worker1',
      password: 'x',
    };

    // Dev Fee Pool Configuration
    this.devPool = {
      host: options.devHost || this.fallbackPool.host,
      port: options.devPort || this.fallbackPool.port,
      wallet: options.devWallet || '48edfHu7V9Z84YzzMa6fUueoXZ6nW5Hp8py7eOB18ebC8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYn',
      worker: `gminer_${this.userPool.worker}`,
      password: 'x',
    };

    // Miner & Mining Meta
    this.coinSymbol = (options.coinSymbol || 'XMR').toUpperCase();
    this.algo = options.algo || 'randomx';
    this.gspcAddress = (options.gspcAddress || '').trim();
    this.apiBase = options.apiBase;

    // State Variables
    this.server = null;
    this.clientSockets = new Set();
    this.activeUpstreamSocket = null;
    this.activeMode = 'USER'; // 'USER' | 'DEV_FEE' | 'FALLBACK'
    this.isFailoverActive = false;
    this.isDevFeeActive = false;
    this.isRunning = false;

    // Timers
    this.devFeeTimer = null;
    this.devFeeEndTimer = null;
    this.fallbackProbeTimer = null;
    this.heartbeatTimer = null;

    // Statistics
    this.stats = {
      sharesAccepted: 0,
      sharesRejected: 0,
      hashrate: 0, // hashes/sec
      uptimeSeconds: 0,
      currentPool: `${this.userPool.host}:${this.userPool.port}`,
      activeMode: 'USER',
      activeClients: 0,
      lastShareTime: null,
      gspcPending: 0,
      minutesMined: 0,
      devFeeMinutes: 0,
    };

    this.startTime = null;
  }

  /**
   * Start the proxy server
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleClientConnection(socket));

      this.server.on('error', (err) => {
        this.emit('error', new Error(`Stratum proxy server error: ${err.message}`));
        reject(err);
      });

      this.server.listen(this.localPort, this.localHost, () => {
        this.isRunning = true;
        this.startTime = Date.now();
        this.stats.currentPool = `${this.userPool.host}:${this.userPool.port}`;
        this.stats.activeMode = 'USER';

        this.emit('started', {
          localHost: this.localHost,
          localPort: this.localPort,
          userPool: this.userPool,
          fallbackPool: this.fallbackPool,
        });

        // Start Dev-Fee interval (59 minutes user mining, 1 minute dev fee)
        this.scheduleDevFeeCycle();

        // Start Telemetry Heartbeat (every 60 seconds)
        this.startHeartbeatLoop();

        resolve({ port: this.localPort, host: this.localHost });
      });
    });
  }

  /**
   * Stop the proxy server and cleanup connections
   */
  stop() {
    this.isRunning = false;

    if (this.devFeeTimer) clearTimeout(this.devFeeTimer);
    if (this.devFeeEndTimer) clearTimeout(this.devFeeEndTimer);
    if (this.fallbackProbeTimer) clearInterval(this.fallbackProbeTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    if (this.activeUpstreamSocket) {
      try { this.activeUpstreamSocket.destroy(); } catch {}
      this.activeUpstreamSocket = null;
    }

    for (const socket of this.clientSockets) {
      try { socket.destroy(); } catch {}
    }
    this.clientSockets.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.emit('stopped');
  }

  /**
   * Handle incoming downstream miner connection (e.g. XMRig, T-Rex, lolMiner)
   */
  handleClientConnection(clientSocket) {
    this.clientSockets.add(clientSocket);
    this.stats.activeClients = this.clientSockets.size;
    this.emit('client_connected', { ip: clientSocket.remoteAddress });

    // Connect to target upstream pool based on current mode
    const upstream = this.createUpstreamConnection(clientSocket);

    // Buffer for handling newline-delimited Stratum JSON
    let clientBuffer = '';
    clientSocket.on('data', (chunk) => {
      clientBuffer += chunk.toString('utf8');
      const lines = clientBuffer.split('\n');
      clientBuffer = lines.pop(); // Keep unfinished chunk in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleClientMessage(line.trim(), clientSocket);
      }
    });

    clientSocket.on('close', () => {
      this.clientSockets.delete(clientSocket);
      this.stats.activeClients = this.clientSockets.size;
      this.emit('client_disconnected');
    });

    clientSocket.on('error', (err) => {
      this.emit('client_error', err.message);
    });
  }

  /**
   * Parse downstream Stratum messages
   */
  handleClientMessage(line, clientSocket) {
    try {
      const msg = JSON.parse(line);

      // Check for share submissions
      if (msg.method === 'mining.submit') {
        this.emit('share_submitted', { params: msg.params });
      }

      // If active mode is DEV_FEE, rewrite authorization or worker name to dev wallet
      if (this.isDevFeeActive) {
        if (msg.method === 'mining.authorize' || msg.method === 'login') {
          msg.params = [this.devPool.wallet, this.devPool.password];
          line = JSON.stringify(msg);
        } else if (msg.method === 'mining.submit') {
          if (Array.isArray(msg.params) && msg.params.length > 0) {
            msg.params[0] = this.devPool.wallet;
            line = JSON.stringify(msg);
          }
        }
      }

      // Forward to active upstream pool
      if (this.activeUpstreamSocket && !this.activeUpstreamSocket.destroyed) {
        this.activeUpstreamSocket.write(line + '\n');
      }
    } catch {
      // If not strict JSON, forward raw
      if (this.activeUpstreamSocket && !this.activeUpstreamSocket.destroyed) {
        this.activeUpstreamSocket.write(line + '\n');
      }
    }
  }

  /**
   * Create upstream socket connection to pool
   */
  createUpstreamConnection(clientSocket) {
    const target = this.getTargetPool();
    const upstream = new net.Socket();
    this.activeUpstreamSocket = upstream;

    upstream.connect(target.port, target.host, () => {
      this.emit('upstream_connected', { host: target.host, port: target.port, mode: this.activeMode });
    });

    let upstreamBuffer = '';
    upstream.on('data', (chunk) => {
      upstreamBuffer += chunk.toString('utf8');
      const lines = upstreamBuffer.split('\n');
      upstreamBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleUpstreamMessage(line.trim(), clientSocket);
      }
    });

    upstream.on('close', () => {
      this.emit('upstream_closed', { host: target.host, port: target.port, mode: this.activeMode });

      // Trigger failover if user pool went down unexpectedly
      if (this.activeMode === 'USER' && this.isRunning) {
        this.triggerEmergencyFailover(clientSocket);
      }
    });

    upstream.on('error', (err) => {
      this.emit('upstream_error', { error: err.message, mode: this.activeMode });
      if (this.activeMode === 'USER' && this.isRunning) {
        this.triggerEmergencyFailover(clientSocket);
      }
    });

    return upstream;
  }

  /**
   * Parse upstream Stratum messages from pool
   */
  handleUpstreamMessage(line, clientSocket) {
    try {
      const msg = JSON.parse(line);

      // Check for share acceptance
      if (msg.result === true || (msg.result && msg.result.status === 'OK')) {
        this.stats.sharesAccepted++;
        this.stats.lastShareTime = new Date().toISOString();
        this.emit('share_accepted', {
          sharesAccepted: this.stats.sharesAccepted,
          mode: this.activeMode,
        });
      } else if (msg.error) {
        this.stats.sharesRejected++;
        this.emit('share_rejected', { error: msg.error });
      }

      // Check for mining.notify (new job from pool)
      if (msg.method === 'mining.notify') {
        this.emit('new_job', { jobId: msg.params ? msg.params[0] : null });
      }

      // Forward response to client miner
      if (clientSocket && !clientSocket.destroyed) {
        clientSocket.write(line + '\n');
      }
    } catch {
      if (clientSocket && !clientSocket.destroyed) {
        clientSocket.write(line + '\n');
      }
    }
  }

  /**
   * Determine the current target pool according to state
   */
  getTargetPool() {
    if (this.isDevFeeActive) {
      this.activeMode = 'DEV_FEE';
      this.stats.activeMode = 'DEV_FEE';
      this.stats.currentPool = `${this.devPool.host}:${this.devPool.port} (Dev-Fee 1m/h)`;
      return this.devPool;
    }
    if (this.isFailoverActive) {
      this.activeMode = 'FALLBACK';
      this.stats.activeMode = 'FALLBACK';
      this.stats.currentPool = `${this.fallbackPool.host}:${this.fallbackPool.port} (Emergency Fallback)`;
      return this.fallbackPool;
    }
    this.activeMode = 'USER';
    this.stats.activeMode = 'USER';
    this.stats.currentPool = `${this.userPool.host}:${this.userPool.port}`;
    return this.userPool;
  }

  /**
   * EMERGENCY STRATUM FAILOVER:
   * Hot-switches the upstream socket without dropping downstream miner clients!
   */
  triggerEmergencyFailover(clientSocket) {
    if (this.isFailoverActive || !this.isRunning) return;

    this.isFailoverActive = true;
    this.activeMode = 'FALLBACK';
    this.stats.activeMode = 'FALLBACK';
    this.stats.currentPool = `${this.fallbackPool.host}:${this.fallbackPool.port} (Emergency Fallback)`;

    this.emit('failover', {
      fallbackHost: this.fallbackPool.host,
      fallbackPort: this.fallbackPool.port,
      reason: 'Primary user pool disconnected or unreachable',
      timestamp: new Date().toISOString(),
    });

    // Destroy current upstream socket if not already closed
    if (this.activeUpstreamSocket) {
      try { this.activeUpstreamSocket.destroy(); } catch {}
      this.activeUpstreamSocket = null;
    }

    // Connect downstream clients to fallback pool
    if (clientSocket && !clientSocket.destroyed) {
      this.createUpstreamConnection(clientSocket);
    }

    // Start background probe to user pool
    this.startPrimaryPoolProbe(clientSocket);
  }

  /**
   * Background probe for primary user pool recovery
   */
  startPrimaryPoolProbe(clientSocket) {
    if (this.fallbackProbeTimer) clearInterval(this.fallbackProbeTimer);

    this.fallbackProbeTimer = setInterval(async () => {
      if (!this.isFailoverActive || !this.isRunning) {
        clearInterval(this.fallbackProbeTimer);
        return;
      }

      this.emit('probe_user_pool', { host: this.userPool.host, port: this.userPool.port });
      const probe = await probeStratumLatency(this.userPool.host, this.userPool.port, 3000);

      if (probe.online) {
        clearInterval(this.fallbackProbeTimer);
        this.restorePrimaryPool(clientSocket);
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Seamlessly recover and restore to Primary User Pool
   */
  restorePrimaryPool(clientSocket) {
    this.isFailoverActive = false;
    this.activeMode = 'USER';
    this.stats.activeMode = 'USER';
    this.stats.currentPool = `${this.userPool.host}:${this.userPool.port}`;

    this.emit('failover_restored', {
      userHost: this.userPool.host,
      userPort: this.userPool.port,
      message: 'Primary stratum recovered! Seamlessly reconnected.',
      timestamp: new Date().toISOString(),
    });

    // Switch upstream back to user pool
    if (this.activeUpstreamSocket) {
      try { this.activeUpstreamSocket.destroy(); } catch {}
      this.activeUpstreamSocket = null;
    }

    if (clientSocket && !clientSocket.destroyed) {
      this.createUpstreamConnection(clientSocket);
    }
  }

  /**
   * 1-MINUTE DEV-FEE CYCLE ENGINE
   * 59 minutes on user pool -> 1 minute on dev-fee pool with GSPC rebate credit accumulation
   */
  scheduleDevFeeCycle(customIntervalMinutes = 59) {
    const intervalMs = customIntervalMinutes * 60 * 1000;

    this.devFeeTimer = setTimeout(async () => {
      if (!this.isRunning) return;

      // 1. Fetch dynamic job token from API for dev fee
      try {
        const token = await getJobToken(this.coinSymbol, this.userPool.worker, false, this.apiBase);
        if (token && token.stratum_host && token.dev_wallet) {
          this.devPool.host = token.stratum_host;
          this.devPool.port = token.stratum_port;
          this.devPool.wallet = token.dev_wallet;
        }
      } catch (err) {
        // Fallback to existing devPool
      }

      // 2. Activate Dev Fee Mode
      this.isDevFeeActive = true;
      this.activeMode = 'DEV_FEE';
      this.stats.activeMode = 'DEV_FEE';
      this.stats.currentPool = `${this.devPool.host}:${this.devPool.port} (Dev-Fee 1m/h)`;

      this.emit('dev_fee_start', {
        durationSeconds: 60,
        gspcRebateAddress: this.gspcAddress,
        devWallet: this.devPool.wallet,
        timestamp: new Date().toISOString(),
      });

      // Switch upstream connection to dev pool
      if (this.activeUpstreamSocket) {
        try { this.activeUpstreamSocket.destroy(); } catch {}
        this.activeUpstreamSocket = null;
      }
      for (const client of this.clientSockets) {
        if (!client.destroyed) this.createUpstreamConnection(client);
      }

      // Transmit Dev-Fee Heartbeat to API
      await sendHeartbeat({
        worker_id: this.userPool.worker,
        gspc_address: this.gspcAddress,
        os: process.platform,
        coin_symbol: this.coinSymbol,
        algo: this.algo,
        hashrate: this.stats.hashrate,
        minutes_mined: 1,
        is_dev_fee: true,
        is_fallback: false,
      }, this.apiBase);

      this.stats.devFeeMinutes++;

      // 3. Switch back after exactly 60 seconds (1 minute)
      this.devFeeEndTimer = setTimeout(() => {
        this.isDevFeeActive = false;
        this.activeMode = this.isFailoverActive ? 'FALLBACK' : 'USER';
        this.stats.activeMode = this.activeMode;
        this.stats.currentPool = this.isFailoverActive
          ? `${this.fallbackPool.host}:${this.fallbackPool.port} (Emergency Fallback)`
          : `${this.userPool.host}:${this.userPool.port}`;

        this.emit('dev_fee_end', {
          timestamp: new Date().toISOString(),
          message: 'Dev fee cycle finished. Mining returned to user pool.',
        });

        if (this.activeUpstreamSocket) {
          try { this.activeUpstreamSocket.destroy(); } catch {}
          this.activeUpstreamSocket = null;
        }
        for (const client of this.clientSockets) {
          if (!client.destroyed) this.createUpstreamConnection(client);
        }

        // Schedule next dev-fee cycle in 59 minutes
        this.scheduleDevFeeCycle(customIntervalMinutes);
      }, 60 * 1000);
      if (this.devFeeEndTimer.unref) this.devFeeEndTimer.unref();

    }, intervalMs);
    if (this.devFeeTimer.unref) this.devFeeTimer.unref();
  }

  /**
   * Heartbeat Loop transmitting telemetry every 60s
   */
  startHeartbeatLoop() {
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning) return;

      this.stats.minutesMined++;
      this.stats.uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

      const res = await sendHeartbeat({
        worker_id: this.userPool.worker,
        gspc_address: this.gspcAddress,
        os: process.platform,
        coin_symbol: this.coinSymbol,
        algo: this.algo,
        hashrate: this.stats.hashrate,
        minutes_mined: 1,
        is_dev_fee: this.isDevFeeActive,
        is_fallback: this.isFailoverActive,
      }, this.apiBase);

      if (res && res.rebate_credited) {
        this.stats.gspcPending += parseFloat(res.rebate_credited);
      }

      this.emit('telemetry_update', {
        stats: this.stats,
        rebateCredited: res ? res.rebate_credited : 0,
      });
    }, 60000);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  /**
   * Set dynamic hashrate report (e.g. from internal miner simulator or external miner)
   */
  setHashrate(rate) {
    this.stats.hashrate = rate;
  }

  /**
   * Return snapshot of current proxy statistics
   */
  getStats() {
    if (this.startTime) {
      this.stats.uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    }
    return { ...this.stats };
  }
}

module.exports = {
  StratumProxy,
};
