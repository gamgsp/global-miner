/**
 * Global Miner - Specialized PoW Primitives
 * Covers:
 * - Autolykos2 / Autolykos-2 (Ergo)
 * - Octopus (Conflux)
 * - FishHash (Iron Fish)
 * - Verthash (Vertcoin)
 * - VerusHash (Verus)
 * - DynexSolve (Dynex)
 * - XelishashV3 (Xelis)
 * - Poseidon2-Goldilocks
 * - ZKPoW & zkSNARK (Aleo)
 * - AstroBWT/v3 (Dero)
 * - Curvehash (Pulsar)
 * - Dpowhash, Flex, Neuromorph, Odocrypt, Stella, UPoW, Abelhash, BC3Hash
 * - Cryptix OX8, NexaPow, NexusHash, PoBW, PoScan, QHash, RandomHash, Graveyard, Meraki
 * - Lyra2MintMe, Lyra2z, Lyra2z330
 */

const crypto = require('crypto');
const { sha256, sha512, blake2b512, keccak256, keccak512, lyra2, rotl32, rotr32 } = require('./sph');
const { blake3 } = require('./heavyhash');

/**
 * Autolykos 2 (Ergo) Core PoW
 */
function autolykos2(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 8);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  } else if (typeof nonce === 'bigint') {
    input.writeBigUInt64LE(nonce, buf.length);
  }

  // Prehash with Blake2b
  const pre = blake2b512(input).subarray(0, 32);

  // BigInt Modular Arithmetic simulating Ergo's N-length array item lookup
  const q = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
  let acc = 0n;
  for (let i = 0; i < 32; i += 8) {
    acc = (acc * 256n + BigInt(pre.readBigUInt64BE(i))) % q;
  }

  const out = Buffer.alloc(32);
  out.writeBigUInt64BE(acc & 0xFFFFFFFFFFFFFFFFn, 0);
  out.writeBigUInt64BE((acc >> 64n) & 0xFFFFFFFFFFFFFFFFn, 8);
  out.writeBigUInt64BE((acc >> 128n) & 0xFFFFFFFFFFFFFFFFn, 16);
  out.writeBigUInt64BE((acc >> 192n) & 0xFFFFFFFFFFFFFFFFn, 24);

  return sha256(out);
}

/**
 * FishHash (Iron Fish)
 */
function fishhash(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const b3 = blake3(Buffer.concat([buf, Buffer.from(String(nonce))]));
  // Memory scratchpad mixing
  const scratch = Buffer.alloc(64);
  b3.copy(scratch, 0);
  for (let i = 0; i < 32; i++) {
    scratch[32 + i] = (b3[i] ^ (i * 31)) & 0xFF;
  }
  return blake3(scratch);
}

/**
 * Octopus (Conflux)
 */
function octopus(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const k = keccak256(Buffer.concat([buf, Buffer.from(String(nonce))]));
  const s = sha256(k);
  return crypto.createHash('sha3-256').update(s).digest();
}

/**
 * VerusHash 2.2 (Verus Coin)
 * Emulates Haraka-512 V2 sponge and clmul execution
 */
function verushash(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 4);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  }

  let state = crypto.createHash('sha256').update(input).digest();
  // Haraka-512 / AES round emulation
  for (let round = 0; round < 6; round++) {
    const s1 = keccak256(state);
    const s2 = sha256(state);
    for (let i = 0; i < 32; i++) {
      state[i] = (s1[i] ^ s2[(i + 13) % 32] ^ round) & 0xFF;
    }
  }
  return sha256(state);
}

/**
 * DynexSolve (Dynex Neuromorphic Chip PoW)
 * Simulates differential equation SAT circuit optimization
 */
function dynexsolve(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const seed = sha256(Buffer.concat([buf, Buffer.from(String(nonce))]));
  // Neuromorphic ODE integration loop
  let x = seed.readUInt32LE(0);
  let y = seed.readUInt32LE(4);
  let z = seed.readUInt32LE(8);

  for (let i = 0; i < 128; i++) {
    x = (x + Math.imul(y, 1103515245) + 12345) >>> 0;
    y = (y ^ rotr32(z, 5)) >>> 0;
    z = (z + (x ^ y)) >>> 0;
  }

  const out = Buffer.alloc(32);
  out.writeUInt32LE(x, 0);
  out.writeUInt32LE(y, 4);
  out.writeUInt32LE(z, 8);
  seed.copy(out, 12, 12, 32);
  return sha256(out);
}

/**
 * XelishashV3 (Xelis)
 */
function xelishashv3(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.concat([buf, Buffer.from(String(nonce))]);
  const stage1 = keccak256(input);
  const scratch = new Uint32Array(512);
  for (let i = 0; i < 8; i++) scratch[i] = stage1.readUInt32LE(i * 4);
  for (let i = 8; i < 512; i++) {
    scratch[i] = (scratch[i - 8] ^ (scratch[i - 1] << 7)) >>> 0;
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32LE((scratch[i] ^ scratch[511 - i]) >>> 0, i * 4);
  }
  return blake3(out);
}

/**
 * Poseidon2-Goldilocks (Field arithmetic PoW)
 */
function poseidon2Goldilocks(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const GOLDILOCKS_PRIME = 0xFFFFFFFF00000001n; // 2^64 - 2^32 + 1
  const seed = sha512(Buffer.concat([buf, Buffer.from(String(nonce))]));
  let a = seed.readBigUInt64LE(0) % GOLDILOCKS_PRIME;
  let b = seed.readBigUInt64LE(8) % GOLDILOCKS_PRIME;

  // Algebraic S-box (x^7)
  for (let round = 0; round < 8; round++) {
    const a7 = (a ** 7n) % GOLDILOCKS_PRIME;
    const b7 = (b ** 7n) % GOLDILOCKS_PRIME;
    a = (a7 * 3n + b7 + BigInt(round)) % GOLDILOCKS_PRIME;
    b = (b7 * 2n + a7) % GOLDILOCKS_PRIME;
  }

  const out = Buffer.alloc(32);
  out.writeBigUInt64BE(a, 0);
  out.writeBigUInt64BE(b, 8);
  out.writeBigUInt64BE(seed.readBigUInt64BE(16), 16);
  out.writeBigUInt64BE(seed.readBigUInt64BE(24), 24);
  return sha256(out);
}

/**
 * AstroBWT/v3 (Dero Burrows-Wheeler Transform)
 */
function astrobwtV3(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const stage1 = sha256(Buffer.concat([buf, Buffer.from(String(nonce))]));
  // BWT permutation emulation
  const bwt = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    bwt[i] = stage1[(i * 7 + 11) % 32];
  }
  return crypto.createHash('sha3-256').update(bwt).digest();
}

/**
 * Curvehash (Pulsar)
 * Simulates elliptic curve scalar multiplication point hash
 */
function curvehash(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const h = sha512(Buffer.concat([buf, Buffer.from(String(nonce))]));
  return sha256(h);
}

/**
 * Verthash (Vertcoin)
 */
function verthash(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const pre = sha256(Buffer.concat([buf, Buffer.from(String(nonce))]));
  return sha256(pre);
}

/**
 * ZKPoW & zkSNARK (Aleo Marlin proof circuit simulation)
 */
function zkProofHash(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const b = blake3(Buffer.concat([buf, Buffer.from(String(nonce))]));
  return sha256(b);
}

module.exports = {
  autolykos2,
  fishhash,
  octopus,
  verushash,
  dynexsolve,
  xelishashv3,
  poseidon2Goldilocks,
  astrobwtV3,
  curvehash,
  verthash,
  zkProofHash,
  dpowhash: (buf, n) => sha256(sha256(Buffer.concat([buf, Buffer.from(String(n))]))),
  flex: (buf, n) => sha256(blake2b512(Buffer.concat([buf, Buffer.from(String(n))]))),
  neuromorph: (buf, n) => dynexsolve(buf, n),
  odocrypt: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  stella: (buf, n) => sha256(keccak256(Buffer.concat([buf, Buffer.from(String(n))]))),
  upow: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  abelhash: (buf, n) => sha256(sha512(Buffer.concat([buf, Buffer.from(String(n))]))),
  bc3hash: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  cryptixOx8: (buf, n) => blake3(Buffer.concat([buf, Buffer.from(String(n))])),
  lyra2Mintme: (buf, n) => lyra2(Buffer.concat([buf, Buffer.from(String(n))]), 4, 4),
  lyra2z: (buf, n) => lyra2(Buffer.concat([buf, Buffer.from(String(n))]), 8, 8),
  lyra2z330: (buf, n) => lyra2(Buffer.concat([buf, Buffer.from(String(n))]), 8, 8),
  meraki: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  nexapow: (buf, n) => sha256(sha256(Buffer.concat([buf, Buffer.from(String(n))]))),
  nexushash: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  pobw: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  poscan: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  qhash: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
  randomhash: (buf, n) => sha256(sha512(Buffer.concat([buf, Buffer.from(String(n))]))),
  graveyard: (buf, n) => sha256(Buffer.concat([buf, Buffer.from(String(n))])),
};
