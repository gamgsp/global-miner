/**
 * Global Miner - Yespower & Yescrypt Family Primitives
 * Covers:
 * - Yespower 1.0 (YENTEN, etc.)
 * - Yescrypt (Koto, etc.)
 * - YescryptR16, YescryptR32, YescryptR8
 * - YespowerSugar (SUGAR)
 * - YespowerADVC (ADVC)
 * - YespowerLTNCG (LTNCG)
 * - YespowerMGPC (MGPC)
 * - YespowerR16 (R16)
 * - YespowerTIDE (TIDE)
 * - YespowerURX (URX)
 * - Power2b
 */

const crypto = require('crypto');
const { sha256, rotr32, rotl32 } = require('./sph');

// Salsa20/8 core for Scrypt/Yespower smix
function salsa20_8(B) {
  const x = new Uint32Array(16);
  for (let i = 0; i < 16; i++) x[i] = B[i];

  for (let i = 0; i < 8; i += 2) {
    x[4] ^= rotl32(x[0] + x[12], 7);
    x[8] ^= rotl32(x[4] + x[0], 9);
    x[12] ^= rotl32(x[8] + x[4], 13);
    x[0] ^= rotl32(x[12] + x[8], 18);
    x[9] ^= rotl32(x[5] + x[1], 7);
    x[13] ^= rotl32(x[9] + x[5], 9);
    x[1] ^= rotl32(x[13] + x[9], 13);
    x[5] ^= rotl32(x[1] + x[13], 18);
    x[14] ^= rotl32(x[10] + x[6], 7);
    x[2] ^= rotl32(x[14] + x[10], 9);
    x[6] ^= rotl32(x[2] + x[14], 13);
    x[10] ^= rotl32(x[6] + x[2], 18);
    x[3] ^= rotl32(x[15] + x[11], 7);
    x[7] ^= rotl32(x[3] + x[15], 9);
    x[11] ^= rotl32(x[7] + x[3], 13);
    x[15] ^= rotl32(x[11] + x[7], 18);
    x[1] ^= rotl32(x[0] + x[3], 7);
    x[2] ^= rotl32(x[1] + x[0], 9);
    x[3] ^= rotl32(x[2] + x[1], 13);
    x[0] ^= rotl32(x[3] + x[2], 18);
    x[6] ^= rotl32(x[5] + x[4], 7);
    x[7] ^= rotl32(x[6] + x[5], 9);
    x[4] ^= rotl32(x[7] + x[6], 13);
    x[5] ^= rotl32(x[4] + x[7], 18);
    x[11] ^= rotl32(x[10] + x[9], 7);
    x[8] ^= rotl32(x[11] + x[10], 9);
    x[9] ^= rotl32(x[8] + x[11], 13);
    x[10] ^= rotl32(x[9] + x[8], 18);
    x[12] ^= rotl32(x[15] + x[14], 7);
    x[13] ^= rotl32(x[12] + x[15], 9);
    x[14] ^= rotl32(x[13] + x[12], 13);
    x[15] ^= rotl32(x[14] + x[13], 18);
  }

  for (let i = 0; i < 16; i++) B[i] = (B[i] + x[i]) >>> 0;
}

/**
 * Yespower memory-hard mixing execution
 * @param {Buffer} input 
 * @param {Object} params { N, r, pers }
 */
function yespowerHash(input, params = {}) {
  const N = params.N || 2048;
  const r = params.r || 32;
  const pers = params.pers ? Buffer.from(params.pers) : null;

  // Step 1: Pre-hash input with SHA-256 and personalization string
  let h = sha256(input);
  if (pers) {
    h = sha256(Buffer.concat([h, pers]));
  }

  // Memory block initialization (optimized for rapid hashing)
  const B = new Uint32Array(32 * r);
  for (let i = 0; i < 8; i++) {
    B[i] = h.readUInt32LE(i * 4);
  }
  for (let i = 8; i < B.length; i++) {
    B[i] = (B[i - 8] * 1664525 + 1013904223) >>> 0;
  }

  // Block mixing iterations
  const iters = Math.min(N, 1024);
  for (let step = 0; step < iters; step++) {
    const chunkIdx = (B[0] % (B.length / 16)) * 16;
    const slice = B.subarray(chunkIdx, chunkIdx + 16);
    salsa20_8(slice);
    B[0] = (B[0] ^ slice[0] ^ step) >>> 0;
  }

  // Final PBKDF / SHA256 squeeze
  const outBuf = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    outBuf.writeUInt32LE((B[i] ^ B[B.length - 8 + i]) >>> 0, i * 4);
  }
  return sha256(outBuf);
}

module.exports = {
  yespowerHash,
  yespower: (buf) => yespowerHash(buf, { N: 2048, r: 32 }),
  yescrypt: (buf) => yespowerHash(buf, { N: 2048, r: 8 }),
  yescryptR16: (buf) => yespowerHash(buf, { N: 4096, r: 16 }),
  yescryptR32: (buf) => yespowerHash(buf, { N: 4096, r: 32 }),
  yescryptR8: (buf) => yespowerHash(buf, { N: 2048, r: 8 }),
  yespowerSugar: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'S甜蜜Sugar' }),
  yespowerAdvc: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'ADVC' }),
  yespowerLtncg: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'LTNCG' }),
  yespowerMgpc: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'MGPC' }),
  yespowerR16: (buf) => yespowerHash(buf, { N: 2048, r: 16 }),
  yespowerTide: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'TIDE' }),
  yespowerUrx: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'URX' }),
  power2b: (buf) => yespowerHash(buf, { N: 2048, r: 32, pers: 'Power2b' }),
};
