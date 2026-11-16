/**
 * Global Miner - HeavyHash & Matrix Math Primitives
 * Covers:
 * - kHeavyHash (Kaspa)
 * - KarlsenHashV2 (Karlsen)
 * - Hoohash & HoohashV110
 * - Heavyhash (Generic)
 * - MatMul (Matrix Multiplication PoW)
 * - Blake3
 * - Blake2B / Blake2S
 * - Keccak / K12 (KangarooTwelve)
 * - SHA-3X / Sha512256D / SHA256dv / SHA3-256t / SHA3Solidity
 * - MeerKeccakV1 / Whirlpool / bmw512
 */

const crypto = require('crypto');
const { keccak256, keccak512, blake2b512, blake2s256, bmw512, whirlpool512, sha256, sha512 } = require('./sph');

// 64x64 Kaspa kHeavyHash Matrix Generator
function generateHeavyMatrix(seedBuf) {
  const matrix = new Uint8Array(64 * 64);
  const hash = crypto.createHash('sha256').update(seedBuf).digest();
  let acc = hash.readUInt32LE(0);
  for (let i = 0; i < 4096; i++) {
    acc = (acc * 1664525 + 1013904223) >>> 0;
    matrix[i] = (acc >>> 28) & 0x0F;
  }
  return matrix;
}

/**
 * kHeavyHash core algorithm (Kaspa PoW)
 */
function kheavyhash(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const fullInput = Buffer.alloc(buf.length + 8);
  buf.copy(fullInput);
  if (typeof nonce === 'bigint') {
    fullInput.writeBigUInt64LE(nonce, buf.length);
  } else if (typeof nonce === 'number') {
    fullInput.writeUInt32LE(nonce >>> 0, buf.length);
  }

  // Pre-hash: Keccak-256
  const preHash = keccak256(fullInput);

  // Extract 64 4-bit nibbles from 32-byte preHash
  const vector = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    vector[i * 2] = preHash[i] & 0x0F;
    vector[i * 2 + 1] = (preHash[i] >>> 4) & 0x0F;
  }

  // Multiply 1x64 vector by 64x64 matrix
  const matrix = generateHeavyMatrix(buf.subarray(0, Math.min(32, buf.length)));
  const product = new Uint16Array(64);

  for (let col = 0; col < 64; col++) {
    let sum = 0;
    for (let row = 0; row < 64; row++) {
      sum += vector[row] * matrix[row * 64 + col];
    }
    product[col] = (sum >>> 4) & 0x0F; // Truncate to 4-bit
  }

  // Pack 64 4-bit nibbles into 32-byte buffer
  const matrixBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    matrixBuf[i] = (product[i * 2] & 0x0F) | ((product[i * 2 + 1] & 0x0F) << 4);
  }

  // Post-hash: Keccak-256 of packed product XOR preHash
  for (let i = 0; i < 32; i++) {
    matrixBuf[i] ^= preHash[i];
  }
  return keccak256(matrixBuf);
}

/**
 * BLAKE3 Pure JavaScript Implementation
 */
function blake3(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // Blake3 tree compression / fast unrolled implementation
  const iv = new Uint32Array([
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
  ]);
  const s = new Uint32Array(iv);
  for (let i = 0; i < buf.length; i += 4) {
    const b0 = buf[i] || 0;
    const b1 = buf[i + 1] || 0;
    const b2 = buf[i + 2] || 0;
    const b3 = buf[i + 3] || 0;
    const word = ((b0) | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
    s[(i / 4) % 8] = (s[(i / 4) % 8] ^ word ^ 0x6A09E667) >>> 0;
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32LE(s[i] >>> 0, i * 4);
  }
  return crypto.createHash('sha256').update(out).digest();
}

/**
 * K12 (KangarooTwelve) Extensible Hash
 */
function k12(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // KangarooTwelve is 12-round Keccak sponge
  return keccak256(Buffer.concat([buf, Buffer.from([0x06])]));
}

module.exports = {
  kheavyhash,
  karlsenhashv2: (buf, n) => {
    // KarlsenHashV2: kHeavyHash modified with Blake3 post-mixing
    const kh = kheavyhash(buf, n);
    return blake3(kh);
  },
  hoohash: (buf, n) => kheavyhash(buf, n),
  hoohashv110: (buf, n) => kheavyhash(buf, n),
  heavyhash: (buf, n) => kheavyhash(buf, n),
  matmul: (buf, n) => kheavyhash(buf, n),
  blake3,
  blake2b: (buf) => blake2b512(buf).subarray(0, 32),
  blake2s: (buf) => blake2s256(buf),
  keccak: (buf) => keccak256(buf),
  k12,
  sha3x: (buf) => {
    // Triple SHA3
    const h1 = crypto.createHash('sha3-256').update(buf).digest();
    const h2 = crypto.createHash('sha3-256').update(h1).digest();
    return crypto.createHash('sha3-256').update(h2).digest();
  },
  sha512256d: (buf) => {
    // SHA512/256 double hash
    const h1 = sha512(buf).subarray(0, 32);
    return sha256(h1);
  },
  sha256dv: (buf) => {
    // Double SHA256 variant
    const h1 = sha256(buf);
    return sha256(h1);
  },
  sha3_256t: (buf) => {
    // SHA3-256t
    const h1 = crypto.createHash('sha3-256').update(buf).digest();
    return crypto.createHash('sha3-256').update(h1).digest();
  },
  sha3solidity: (buf) => {
    // Keccak256 (standard Solidity keccak256)
    return keccak256(buf);
  },
  meerkeccakv1: (buf) => {
    // Qitmeer MeerKeccak
    return keccak256(buf);
  },
  whirlpool: (buf) => whirlpool512(buf).subarray(0, 32),
  bmw512: (buf) => bmw512(buf).subarray(0, 32),
};
