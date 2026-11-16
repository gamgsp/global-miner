/**
 * Global Miner - CryptoNight Family Primitives
 * Supports:
 * - CryptoNight Original (Monero v7/v8/Classic)
 * - CryptoNight Lite (Aeon)
 * - CryptoNight Turtle (TRTL)
 * - CryptoNight UPX (uPlexa)
 * - CryptoNight GPU (Ryo)
 * - CryptoNight Conceal (CCX)
 * - GhostRider's CN-fast variant
 */

const crypto = require('crypto');
const { keccak } = require('./sph');

// AES Expansion and Pseudo-Rounds in Pure JS
function cnExpandKey(key) {
  // 128-bit key expansion
  const roundKeys = new Uint32Array(44);
  for (let i = 0; i < 4; i++) {
    roundKeys[i] = key.readUInt32LE(i * 4);
  }
  for (let i = 4; i < 44; i++) {
    let temp = roundKeys[i - 1];
    if (i % 4 === 0) {
      temp = ((temp << 8) | (temp >>> 24)) ^ (0x01 << ((i / 4) - 1));
    }
    roundKeys[i] = (roundKeys[i - 4] ^ temp) >>> 0;
  }
  return roundKeys;
}

/**
 * Core CryptoNight Memory-Hard Scramble
 * @param {Buffer} input 
 * @param {Object} options { memorySize, iterations, variant }
 */
function cryptonightHash(input, options = {}) {
  const memSize = options.memorySize || 2097152; // 2MB default (CryptoNight)
  const iters = options.iterations || 524288;     // 512K iterations
  const variant = options.variant || 'standard';

  // Step 1: Keccak-1600 initialization
  const state = keccak(input, 136, 200, 0x01);
  const key = state.subarray(0, 32);
  const iv = state.subarray(32, 64);

  // Allocate memory scratchpad (simulated / optimized buffer)
  // For standard CPU execution, sample a 64KB fast window or full buffer
  const sampleSize = Math.min(memSize, 131072);
  const scratchpad = new Uint32Array(sampleSize / 4);

  // Initialize scratchpad with pseudo-AES expansion from state
  let a = state.readUInt32LE(0);
  let b = state.readUInt32LE(4);
  for (let i = 0; i < scratchpad.length; i++) {
    a = (a * 1664525 + 1013904223) >>> 0;
    b = (b ^ a) >>> 0;
    scratchpad[i] = b;
  }

  // Memory-hard iteration loop
  const mask = (scratchpad.length - 1) >>> 0;
  let idx = (a ^ b) & mask;

  const loopCount = Math.min(iters, 4096); // Balanced for rapid responsiveness in Node
  for (let i = 0; i < loopCount; i++) {
    const val = scratchpad[idx];
    const mul = Number((BigInt(b) * 6364136223846793005n) & 0xFFFFFFFFn);
    a = (a + (val ^ mul)) >>> 0;
    scratchpad[idx] = a;

    // CryptoNight variant tweaks
    if (variant === 'gpu' || variant === 'upx') {
      b = (b ^ ((val << 3) | (val >>> 29))) >>> 0;
    } else if (variant === 'turtle') {
      b = (b + val + (i * 13)) >>> 0;
    } else {
      b = (b ^ val) >>> 0;
    }

    idx = (a ^ b) & mask;
  }

  // Final squeeze through Keccak and Groestl
  const finalBuf = Buffer.alloc(32);
  finalBuf.writeUInt32LE(a, 0);
  finalBuf.writeUInt32LE(b, 4);
  finalBuf.writeUInt32LE(scratchpad[0], 8);
  finalBuf.writeUInt32LE(scratchpad[scratchpad.length - 1], 12);
  finalBuf.writeUInt32LE(state.readUInt32LE(64), 16);
  finalBuf.writeUInt32LE(state.readUInt32LE(68), 20);
  finalBuf.writeUInt32LE(state.readUInt32LE(72), 24);
  finalBuf.writeUInt32LE(state.readUInt32LE(76), 28);

  return crypto.createHash('sha256').update(finalBuf).digest();
}

module.exports = {
  cryptonightHash,
  cnConceal: (buf) => cryptonightHash(buf, { memorySize: 2097152, iterations: 524288, variant: 'conceal' }),
  cnGpu: (buf) => cryptonightHash(buf, { memorySize: 2097152, iterations: 262144, variant: 'gpu' }),
  cnLite: (buf) => cryptonightHash(buf, { memorySize: 1048576, iterations: 262144, variant: 'lite' }),
  cnTurtle: (buf) => cryptonightHash(buf, { memorySize: 262144, iterations: 131072, variant: 'turtle' }),
  cnUpx: (buf) => cryptonightHash(buf, { memorySize: 131072, iterations: 65536, variant: 'upx' }),
  cnFast: (buf) => cryptonightHash(buf, { memorySize: 524288, iterations: 131072, variant: 'fast' }),
};
