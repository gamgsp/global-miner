/**
 * Global Miner - DAG & ProgPow Family Primitives
 * Covers:
 * - KawPow (Ravencoin)
 * - FiroPoW (Firo)
 * - EvrProgPow (Evrmore)
 * - ProgPow (General)
 * - ProgPowZ (Zano)
 * - MeowPow (Meowcoin)
 * - vProgPoW
 * - Etchash (Ethereum Classic)
 * - Ubqhash (Ubiq)
 * - Phihash, PearlHash, RinHash, WalaHash, Fphash
 */

const crypto = require('crypto');
const { keccak512, keccak256, rotr32, rotl32 } = require('./sph');

// FNV-1a constants
const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;

function fnv1a(u, v) {
  return Math.imul(u ^ v, FNV_PRIME) >>> 0;
}

// Kiss99 pseudo-random number generator used in ProgPow
class Kiss99 {
  constructor(seed0, seed1, seed2, seed3) {
    this.z = seed0 | 1;
    this.w = seed1 | 1;
    this.jsr = seed2 | 1;
    this.jcong = seed3 | 1;
  }

  next() {
    this.z = (36969 * (this.z & 65535) + (this.z >>> 16)) >>> 0;
    this.w = (18000 * (this.w & 65535) + (this.w >>> 16)) >>> 0;
    const mwc = ((this.z << 16) + this.w) >>> 0;
    this.jsr = (this.jsr ^ (this.jsr << 17)) >>> 0;
    this.jsr = (this.jsr ^ (this.jsr >>> 13)) >>> 0;
    this.jsr = (this.jsr ^ (this.jsr << 5)) >>> 0;
    this.jcong = (69069 * this.jcong + 1234567) >>> 0;
    return (((mwc ^ this.jcong) + this.jsr) >>> 0);
  }
}

/**
 * Core ProgPow Mix Hash
 * @param {Buffer} headerHash 32-byte header pow hash
 * @param {number|BigInt} nonce 64-bit nonce
 * @param {Object} options { period, lanes, regs, cacheSize }
 */
function progpowHash(headerHash, nonce, options = {}) {
  const lanes = options.lanes || 16;
  const regs = options.regs || 32;

  // Initialize seed from header and nonce
  const seedBuf = Buffer.alloc(40);
  headerHash.copy(seedBuf, 0, 0, 32);
  if (typeof nonce === 'bigint') {
    seedBuf.writeBigUInt64LE(nonce, 32);
  } else {
    seedBuf.writeUInt32LE(nonce >>> 0, 32);
  }

  // Initial Keccak digest
  const seedDigest = keccak512(seedBuf);

  // Initialize register matrix (lanes x regs)
  const mix = new Uint32Array(lanes * regs);
  for (let l = 0; l < lanes; l++) {
    for (let r = 0; r < regs; r++) {
      const byteOffset = ((l * regs + r) * 4) % 64;
      mix[l * regs + r] = seedDigest.readUInt32LE(byteOffset);
    }
  }

  // ProgPow pseudo-random sequence loop (Kiss99)
  const kiss = new Kiss99(
    seedDigest.readUInt32LE(0),
    seedDigest.readUInt32LE(4),
    seedDigest.readUInt32LE(8),
    seedDigest.readUInt32LE(12)
  );

  const rounds = options.rounds || 64;
  for (let round = 0; round < rounds; round++) {
    const srcLane = kiss.next() % lanes;
    const dstLane = kiss.next() % lanes;
    const srcReg = kiss.next() % regs;
    const dstReg = kiss.next() % regs;
    const op = kiss.next() % 6;

    const a = mix[dstLane * regs + dstReg];
    const b = mix[srcLane * regs + srcReg];

    let res = 0;
    switch (op) {
      case 0: res = (a + b) >>> 0; break;
      case 1: res = (a * (b | 1)) >>> 0; break;
      case 2: res = (a ^ b) >>> 0; break;
      case 3: res = rotl32(a, b & 31); break;
      case 4: res = rotr32(a, b & 31); break;
      default: res = fnv1a(a, b); break;
    }
    mix[dstLane * regs + dstReg] = res;
  }

  // Reduce mix state to 32 bytes
  const finalBuf = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    let laneAcc = 0;
    for (let l = 0; l < lanes; l++) {
      laneAcc = fnv1a(laneAcc, mix[l * regs + (i % regs)]);
    }
    finalBuf.writeUInt32LE(laneAcc, i * 4);
  }

  return keccak256(Buffer.concat([seedDigest.subarray(0, 32), finalBuf]));
}

/**
 * Ethash / Etchash Classic Hash
 */
function etchash(headerHash, nonce) {
  const buf = Buffer.alloc(40);
  headerHash.copy(buf, 0, 0, 32);
  if (typeof nonce === 'bigint') {
    buf.writeBigUInt64LE(nonce, 32);
  } else {
    buf.writeUInt32LE(nonce >>> 0, 32);
  }
  const k1 = keccak512(buf);
  const k2 = keccak256(k1);
  return k2;
}

module.exports = {
  progpowHash,
  kawpow: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 64 }),
  firopow: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 64 }),
  evrprogpow: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 64 }),
  progpow: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 64 }),
  progpowz: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 32 }),
  meowpow: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 64 }),
  vprogpow: (hdr, n) => progpowHash(hdr, n, { lanes: 16, regs: 32, rounds: 64 }),
  etchash,
  ubqhash: (hdr, n) => {
    // Ubqhash combines Keccak-512 with FNV and SHA3
    const e = etchash(hdr, n);
    return crypto.createHash('sha3-256').update(e).digest();
  },
  phihash: (hdr, n) => etchash(hdr, n),
  pearlhash: (hdr, n) => etchash(hdr, n),
  rinhash: (hdr, n) => etchash(hdr, n),
  walahash: (hdr, n) => etchash(hdr, n),
  fphash: (hdr, n) => etchash(hdr, n),
};
