/**
 * Global Miner - Multi-Threaded Worker Process
 * Executes nonce scanning loops on designated CPU cores
 */

const { parentPort, workerData } = require('worker_threads');
const { getAlgorithm, meetsTarget } = require('./registry');

let currentJob = null;
let isMining = false;
let currentAlgo = null;
let currentTarget = null;
let currentHeader = null;
let threadId = workerData ? workerData.threadId : 0;
let totalThreads = workerData ? workerData.totalThreads : 1;

let nonce = threadId * 1000000;
let hashesSinceReport = 0;
let lastReportTime = Date.now();

function scanBatch(batchSize = 250) {
  if (!isMining || !currentJob || !currentAlgo) return;

  const startNonce = nonce;
  for (let i = 0; i < batchSize; i++) {
    const curNonce = nonce++;
    try {
      const hash = currentAlgo.fn(currentHeader, curNonce);
      hashesSinceReport++;

      if (meetsTarget(hash, currentTarget)) {
        parentPort.postMessage({
          type: 'solution',
          data: {
            jobId: currentJob.jobId,
            nonce: curNonce,
            hash: hash.toString('hex'),
            algoId: currentJob.algoId,
            threadId
          }
        });
      }
    } catch (err) {
      // Ignore transient errors
    }
  }

  // Periodic hashrate telemetry report (every 500ms)
  const now = Date.now();
  if (now - lastReportTime >= 500) {
    const elapsedSec = (now - lastReportTime) / 1000;
    const hashrate = hashesSinceReport / elapsedSec;
    parentPort.postMessage({
      type: 'telemetry',
      data: {
        threadId,
        hashCount: hashesSinceReport,
        hashrate: Math.round(hashrate)
      }
    });
    hashesSinceReport = 0;
    lastReportTime = now;
  }

  if (isMining) {
    setImmediate(() => scanBatch(batchSize));
  }
}

parentPort.on('message', (msg) => {
  if (!msg) return;

  switch (msg.type) {
    case 'set_job': {
      currentJob = msg.data;
      currentAlgo = getAlgorithm(currentJob.algoId);
      currentHeader = Buffer.isBuffer(currentJob.header)
        ? currentJob.header
        : Buffer.from(currentJob.header, 'hex');
      currentTarget = currentJob.target;
      if (currentJob.startNonce !== undefined) {
        nonce = currentJob.startNonce + threadId * 500000;
      }
      isMining = true;
      scanBatch();
      break;
    }
    case 'pause':
      isMining = false;
      break;
    case 'resume':
      if (currentJob) {
        isMining = true;
        scanBatch();
      }
      break;
    case 'stop':
      isMining = false;
      currentJob = null;
      break;
  }
});
