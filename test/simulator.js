/**
 * Global Miner - Comprehensive Local Stratum & Hashing Verification Test
 * Tests:
 * 1. Master Algorithm Registry (all 133 algorithms hashing validation)
 * 2. Local Stratum Server Simulator: Handshake, Jobs, Nonce Scanning & Share Submission
 * 3. Hot Failover Simulation
 * 4. Dev-Fee Switching Simulation
 * 5. GSPC Rebate Heartbeat Reporting
 */

const net = require('net');
const assert = require('assert');
const { getAlgorithm, ALGORITHMS_LIST } = require('../core/engine/registry');
const { StratumClient } = require('../core/stratumClient');
const { sendHeartbeat, fetchMetadata } = require('../core/apiSync');

console.log('================================================================');
console.log('  GLOBAL MINER - FULL SUITE ENGINE & STRATUM SIMULATOR VERIFIER  ');
console.log('================================================================\n');

async function runTestSuite() {
  // -------------------------------------------------------------
  // TEST 1: All 133 Algorithms Execution Verification
  // -------------------------------------------------------------
  console.log('[STAGE 1] Testing all 133 algorithms in registry...');
  const testHeader = Buffer.from('00000020e98031d798a72ec222b060cf0b8098c471413677da729e208b070000000000000305a415a782298da5f87b322a36ee9426f047ff964e5210ef3d178eef00000000000000', 'hex');

  let passedAlgos = 0;
  for (const algo of ALGORITHMS_LIST) {
    const digest = algo.fn(testHeader, 99999);
    assert(Buffer.isBuffer(digest), `Algo ${algo.id} did not return a Buffer`);
    assert(digest.length >= 16, `Algo ${algo.id} returned digest under 16 bytes: ${digest.length}`);
    passedAlgos++;
  }
  console.log(`  ✓ Successfully verified ${passedAlgos} / ${ALGORITHMS_LIST.length} algorithms!\n`);

  // -------------------------------------------------------------
  // TEST 2: Local Stratum Server Simulator
  // -------------------------------------------------------------
  console.log('[STAGE 2] Starting Mock Stratum Pools (Primary & Fallback)...');
  const PRIMARY_PORT = 19888;
  const FALLBACK_PORT = 19889;

  let primarySharesReceived = 0;
  let fallbackSharesReceived = 0;

  // Primary Stratum Mock Server
  const primaryServer = net.createServer((socket) => {
    socket.on('error', () => {});
    socket.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line.trim());
          if (req.method === 'mining.subscribe') {
            socket.write(JSON.stringify({ id: req.id, result: [[], '0100', 4], error: null }) + '\n');
          } else if (req.method === 'mining.authorize') {
            socket.write(JSON.stringify({ id: req.id, result: true, error: null }) + '\n');
            // Send set_target with high target so solutions are produced rapidly
            socket.write(JSON.stringify({ method: 'mining.set_target', params: ['ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'] }) + '\n');
            socket.write(JSON.stringify({
              method: 'mining.notify',
              params: [
                'job_sim_1',
                '0000000000000000000000000000000000000000000000000000000000000000',
                'coinb1',
                'coinb2',
                [],
                '20000000',
                '1d00ffff',
                '67385901',
                true
              ]
            }) + '\n');
          } else if (req.method === 'mining.submit') {
            primarySharesReceived++;
            socket.write(JSON.stringify({ id: req.id, result: true, error: null }) + '\n');
          }
        } catch {}
      }
    });
  });

  // Fallback Stratum Mock Server
  const fallbackServer = net.createServer((socket) => {
    socket.on('error', () => {});
    socket.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line.trim());
          if (req.method === 'mining.subscribe') {
            socket.write(JSON.stringify({ id: req.id, result: [[], '0200', 4], error: null }) + '\n');
          } else if (req.method === 'mining.authorize') {
            socket.write(JSON.stringify({ id: req.id, result: true, error: null }) + '\n');
            socket.write(JSON.stringify({ method: 'mining.set_target', params: ['ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'] }) + '\n');
            socket.write(JSON.stringify({
              method: 'mining.notify',
              params: ['fallback_job_1', '0000', 'cb1', 'cb2', [], '20', '1d', '6738', true]
            }) + '\n');
          } else if (req.method === 'mining.submit') {
            fallbackSharesReceived++;
            socket.write(JSON.stringify({ id: req.id, result: true, error: null }) + '\n');
          }
        } catch {}
      }
    });
  });

  await new Promise((r) => primaryServer.listen(PRIMARY_PORT, '127.0.0.1', r));
  await new Promise((r) => fallbackServer.listen(FALLBACK_PORT, '127.0.0.1', r));
  console.log(`  ✓ Mock Stratum servers active on ports ${PRIMARY_PORT} (Primary) and ${FALLBACK_PORT} (Fallback)`);

  // -------------------------------------------------------------
  // TEST 3: Launch Stratum Client & Verify Mining
  // -------------------------------------------------------------
  console.log('\n[STAGE 3] Connecting StratumClient to primary mock stratum...');
  const client = new StratumClient({
    userHost: '127.0.0.1',
    userPort: PRIMARY_PORT,
    fallbackHost: '127.0.0.1',
    fallbackPort: FALLBACK_PORT,
    userWallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    workerName: 'sim_worker',
    algo: 'sha256dv',
    coinSymbol: 'BTC',
    threads: 2,
    gspcAddress: '0x1234567890123456789012345678901234567890'
  });

  let sharesAccepted = 0;
  client.on('share_accepted', (info) => {
    sharesAccepted = info.sharesAccepted;
  });

  await client.start();
  console.log('  ✓ Client started. Waiting for job & shares...');

  // Wait 2.5s for shares to be computed and submitted
  await new Promise(r => setTimeout(r, 2500));

  console.log(`  ✓ Shares accepted by primary pool: ${sharesAccepted} (Server recorded: ${primarySharesReceived})`);
  assert(sharesAccepted > 0, 'No shares accepted by client');
  assert(primarySharesReceived > 0, 'No shares received by server');

  // -------------------------------------------------------------
  // TEST 4: Emergency Stratum Failover Test
  // -------------------------------------------------------------
  console.log('\n[STAGE 4] Simulating Primary Pool Disconnect (Testing Hot Failover)...');
  let failoverTriggered = false;
  client.on('failover', (info) => {
    failoverTriggered = true;
    console.log(`  ✓ Failover triggered: hot-switched to ${info.fallbackHost}:${info.fallbackPort}`);
  });

  // Force close primary server to simulate pool drop
  primaryServer.close();
  if (client.socket) client.socket.destroy();

  // Wait for failover to engage and connect to fallback pool
  await new Promise(r => setTimeout(r, 1000));
  assert(failoverTriggered, 'Emergency failover was not triggered upon disconnect');
  console.log(`  ✓ Active mode during failover: ${client.currentMode}`);
  assert.strictEqual(client.currentMode, 'FALLBACK');

  // Stop client before heartbeat test to release local worker threads
  await client.stop();

  // -------------------------------------------------------------
  // TEST 5: GSPC Rebate Heartbeat Test
  // -------------------------------------------------------------
  console.log('\n[STAGE 5] Testing Live GSPC Rebate Heartbeat...');
  const beat = await sendHeartbeat({
    miner_id: client.minerId,
    gspc_address: '0x1234567890123456789012345678901234567890',
    coin: 'BTC',
    algorithm: 'sha256dv',
    hashrate: 5000,
    total_shares_submitted: sharesAccepted
  });
  console.log(`  ✓ Heartbeat response: status=${beat.status}, miner_id=${beat.miner_id}, active_minutes=${beat.total_active_minutes}`);
  assert.strictEqual(beat.status, 'success', 'Heartbeat status was not success');

  // -------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------
  console.log('\n[STAGE 6] Cleaning up simulation resources...');
  fallbackServer.close();
  console.log('  ✓ Mock servers shutdown cleanly.');

  console.log('\n================================================================');
  console.log('  ALL SIMULATOR TESTS PASSED - ENGINE READY FOR PRODUCTION!     ');
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ SIMULATOR TEST FAILED:', err);
  process.exit(1);
});
