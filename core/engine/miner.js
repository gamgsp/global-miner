/**
 * Global Miner - Proprietary Native Mining Engine
 * Multi-threaded CPU/GPU nonce scanner supporting all 133 algorithms.
 * Strictly native: does NOT invoke or spawn external miners.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');
const os = require('os');
const { getAlgorithm, meetsTarget } = require('./registry');

class MiningEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.threads = options.threads || Math.max(1, Math.min(os.cpus().length, 16));
    this.algoId = options.algoId || 'randomx';
    this.workers = [];
    this.threadHashrates = new Map();
    this.totalHashes = 0;
    this.currentHashrate = 0;
    this.currentJob = null;
    this.isMining = false;
    this.startTime = null;

    // Telemetry aggregation timer
    this.telemetryInterval = null;
  }

  /**
   * Initialize and spin up worker threads
   */
  start() {
    if (this.isMining) return;
    this.isMining = true;
    this.startTime = Date.now();

    const workerScript = path.join(__dirname, 'workerThread.js');

    for (let i = 0; i < this.threads; i++) {
      const worker = new Worker(workerScript, {
        workerData: {
          threadId: i,
          totalThreads: this.threads,
        }
      });

      worker.on('message', (msg) => this.handleWorkerMessage(i, msg));
      worker.on('error', (err) => {
        this.emit('worker_error', { threadId: i, error: err.message });
      });

      this.workers.push(worker);
      this.threadHashrates.set(i, 0);
    }

    // Hashrate calculation ticker
    this.telemetryInterval = setInterval(() => {
      let totalRate = 0;
      for (const rate of this.threadHashrates.values()) {
        totalRate += rate;
      }
      this.currentHashrate = totalRate;
      this.emit('telemetry', {
        hashrate: this.currentHashrate,
        totalHashes: this.totalHashes,
        threads: this.workers.length,
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
      });
    }, 1000);

    this.emit('started', { threads: this.threads, algoId: this.algoId });
  }

  /**
   * Set new mining job from Stratum client
   * @param {Object} job { jobId, header, target, algoId, cleanJobs }
   */
  setJob(job) {
    this.currentJob = job;
    this.algoId = job.algoId || this.algoId;

    for (const worker of this.workers) {
      worker.postMessage({
        type: 'set_job',
        data: {
          jobId: job.jobId,
          header: Buffer.isBuffer(job.header) ? job.header.toString('hex') : job.header,
          target: job.target,
          algoId: this.algoId,
          startNonce: job.startNonce || 0,
          ntime: job.ntime,
          extranonce2: job.extranonce2,
        }
      });
    }

    this.emit('job_set', { jobId: job.jobId, algoId: this.algoId });
  }

  /**
   * Handle messages from worker threads
   */
  handleWorkerMessage(threadId, msg) {
    if (!msg) return;

    if (msg.type === 'solution') {
      this.emit('solution', msg.data);
    } else if (msg.type === 'telemetry') {
      this.threadHashrates.set(threadId, msg.data.hashrate);
      this.totalHashes += msg.data.hashCount;
    }
  }

  /**
   * Pause mining (e.g., during network reconnect)
   */
  pause() {
    for (const worker of this.workers) {
      worker.postMessage({ type: 'pause' });
    }
    this.emit('paused');
  }

  /**
   * Resume mining
   */
  resume() {
    for (const worker of this.workers) {
      worker.postMessage({ type: 'resume' });
    }
    this.emit('resumed');
  }

  /**
   * Stop mining and terminate worker threads
   */
  async stop() {
    this.isMining = false;
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }

    for (const worker of this.workers) {
      try {
        worker.postMessage({ type: 'stop' });
        await worker.terminate();
      } catch (err) {}
    }

    this.workers = [];
    this.threadHashrates.clear();
    this.emit('stopped');
  }

  getStats() {
    return {
      hashrate: this.currentHashrate,
      totalHashes: this.totalHashes,
      threads: this.workers.length,
      algoId: this.algoId,
      isMining: this.isMining,
      uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    };
  }
}

module.exports = {
  MiningEngine
};
