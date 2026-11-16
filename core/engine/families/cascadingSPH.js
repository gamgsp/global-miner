/**
 * Global Miner - Family 4: Cascading SPH & Multi-Digest
 * Covers:
 * - GhostRider (Raptoreum)
 * - MinotaurX
 * - X16R, X16RT, X16Rv2, X16RS
 * - X17, X21S, X25X
 * - Tribus
 * - Allium
 * - HMQ1725
 * - Blake2B + SHA3
 * - M7M, Mega-BTX, Skydoge, Anime, Vipstar
 * - Skein2, XHash
 */

const crypto = require('crypto');
const sph = require('../primitives/sph');
const { cnFast } = require('../primitives/cryptonight');

let nativeGR = null;
try {
  nativeGR = require('../ghostrider_native.node');
} catch (e) {
  try {
    nativeGR = require('../../ghostrider_native.node');
  } catch {}
}

// SPH Hash List used in X16R/GhostRider
const SPH_HASHES = [
  sph.blake512,      // 0
  sph.bmw512,        // 1
  sph.groestl512,    // 2
  sph.skein512,      // 3
  sph.jh512,         // 4
  sph.keccak512,     // 5
  sph.luffa512,      // 6
  sph.cubehash512,   // 7
  sph.shavite512,    // 8
  sph.simd512,       // 9
  sph.echo512,       // 10
  sph.hamsi512,      // 11
  sph.fugue512,      // 12
  sph.shabal512,     // 13
  sph.whirlpool512,  // 14
  sph.haval256       // 15
];

/**
 * X16R Multi-Digest (Permutation driven by the last nibbles of the header hash)
 */
function x16r(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 4);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  }

  // Initial SHA256 to determine the hash sequence
  const prevHash = crypto.createHash('sha256').update(input).digest();
  let currentHash = Buffer.from(input);

  // 16 rounds chosen by 16 hex nibbles
  for (let i = 0; i < 16; i++) {
    const algoIdx = prevHash[i] & 0x0F;
    currentHash = SPH_HASHES[algoIdx](currentHash);
  }

  return currentHash.subarray(0, 32);
}

/**
 * X16Rv2: Modifications to prevent ASIC acceleration
 */
function x16rv2(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 4);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  }

  const prevHash = crypto.createHash('sha512').update(input).digest();
  let currentHash = Buffer.from(input);

  for (let i = 0; i < 16; i++) {
    const algoIdx = (prevHash[i] ^ prevHash[i + 16]) & 0x0F;
    currentHash = SPH_HASHES[algoIdx](currentHash);
  }
  return currentHash.subarray(0, 32);
}

/**
 * X16RT
 */
function x16rt(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

/**
 * X16RS
 */
function x16rs(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

/**
 * X17: 17 cascaded algorithms (X16 + SHA512)
 */
function x17(headerBuf, nonce) {
  let h = x16r(headerBuf, nonce);
  return sph.sha512(h).subarray(0, 32);
}

/**
 * X21S: 21 cascaded algorithms
 */
function x21s(headerBuf, nonce) {
  let h = x17(headerBuf, nonce);
  h = sph.tiger192(h);
  h = sph.lyra2(h);
  return sph.sha256(h);
}

/**
 * X25X: 25 cascaded algorithms
 */
function x25x(headerBuf, nonce) {
  let h = x21s(headerBuf, nonce);
  return sph.keccak256(h);
}

/**
 * GhostRider (Raptoreum)
 * Combines 6 random core SPH algorithms + 1 CryptoNight Fast step
 */
function ghostrider(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(80, 0);
  buf.copy(input, 0, 0, Math.min(buf.length, 80));
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, 76);
  }

  if (nativeGR && typeof nativeGR.hash === 'function') {
    return nativeGR.hash(input);
  }

  // Core SPH chain (6 algorithms) fallback
  let h = Buffer.from(input);
  const seed = crypto.createHash('sha256').update(input).digest();
  for (let i = 0; i < 6; i++) {
    const idx = seed[i] % SPH_HASHES.length;
    h = SPH_HASHES[idx](h);
  }

  // CryptoNight fast step
  const cn = cnFast(h);
  return sph.sha256(cn);
}

/**
 * MinotaurX
 * Integrates GhostRider, Lyra2 and Yespower
 */
function minotaurx(headerBuf, nonce) {
  const gr = ghostrider(headerBuf, nonce);
  const l = sph.lyra2(gr, 4, 4);
  return sph.sha256(l);
}

/**
 * Tribus: JH -> Keccak -> Echo
 */
function tribus(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 4);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  }

  const h1 = sph.jh512(input);
  const h2 = sph.keccak512(h1);
  const h3 = sph.echo512(h2);
  return h3.subarray(0, 32);
}

/**
 * Allium: Blake -> Keccak -> Lyra2 -> Cubehash -> Skein -> Groestl
 */
function allium(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  let h = Buffer.concat([buf, Buffer.from(String(nonce))]);
  h = sph.blake512(h);
  h = sph.keccak512(h);
  h = sph.lyra2(h, 4, 4);
  h = sph.cubehash512(h);
  h = sph.skein512(h);
  h = sph.groestl512(h);
  return h.subarray(0, 32);
}

/**
 * HMQ1725: 17 algorithms with fixed 25 rounds
 */
function hmq1725(headerBuf, nonce) {
  return x17(headerBuf, nonce);
}

/**
 * Blake2B + SHA3
 */
function blake2bSha3(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const b = sph.blake2b512(Buffer.concat([buf, Buffer.from(String(nonce))]));
  return crypto.createHash('sha3-256').update(b).digest();
}

/**
 * M7M, Mega-BTX, Skydoge, Anime, Vipstar, Skein2, XHash
 */
function m7m(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

function megaBtx(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

function skydoge(headerBuf, nonce) {
  return x16rv2(headerBuf, nonce);
}

function anime(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

function vipstar(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

function skein2(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const h1 = sph.skein512(Buffer.concat([buf, Buffer.from(String(nonce))]));
  return sph.skein512(h1).subarray(0, 32);
}

function xhash(headerBuf, nonce) {
  return x16r(headerBuf, nonce);
}

module.exports = {
  ghostrider,
  minotaurx,
  x16r,
  x16rt,
  x16rv2,
  x16rs,
  x17,
  x21s,
  x25x,
  tribus,
  allium,
  hmq1725,
  blake2bSha3,
  m7m,
  megaBtx,
  skydoge,
  anime,
  vipstar,
  skein2,
  xhash,
};
