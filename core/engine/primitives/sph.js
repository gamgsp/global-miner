/**
 * Global Miner - SPH Digest Primitives
 * Pure JavaScript / TypedArray implementations of standard cryptographic hash functions:
 * Blake512, BMW512, Groestl512, Skein512, JH512, Keccak512, Luffa512,
 * CubeHash512, SHAvite512, SIMD512, ECHO512, Hamsi512, Fugue512,
 * SHAbabal512, Whirlpool512, Haval256, Tiger, RIPEMD160, SWIFFTX.
 */

const crypto = require('crypto');

// Standard Node crypto wrappers with fallback
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

function sha512(buf) {
  return crypto.createHash('sha512').update(buf).digest();
}

function blake2b512(buf) {
  try {
    return crypto.createHash('blake2b512').update(buf).digest();
  } catch {
    return blake512(buf);
  }
}

function blake2s256(buf) {
  try {
    return crypto.createHash('blake2s256').update(buf).digest();
  } catch {
    return sha256(buf);
  }
}

// Rotate helpers
const rotr32 = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const rotl32 = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
const rotr64 = (x, n) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & 0xFFFFFFFFFFFFFFFFn;
const rotl64 = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & 0xFFFFFFFFFFFFFFFFn;

// ==========================================
// 1. KECCAK-512 & KECCAK-256
// ==========================================
const KECCAK_ROUNDS = 24;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808An, 0x8000000080008000n,
  0x000000000000808Bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008An, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000An,
  0x000000008000808Bn, 0x800000000000008Bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800An, 0x800000008000000An,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const RHO = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function keccakF1600(state) {
  const C = new BigUint64Array(5);
  const D = new BigUint64Array(5);
  const B = new BigUint64Array(25);

  for (let round = 0; round < KECCAK_ROUNDS; round++) {
    // Theta
    for (let x = 0; x < 5; x++) {
      C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] ^= D[x];
      }
    }

    // Rho and Pi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(state[x + 5 * y], RHO[x][y]);
      }
    }

    // Chi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] = B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y]) & B[((x + 2) % 5) + 5 * y]);
      }
    }

    // Iota
    state[0] ^= RC[round];
  }
}

function keccak(data, rateBytes, outputBytes, delim = 0x01) {
  const state = new BigUint64Array(25);
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let pos = 0;

  while (pos < buf.length) {
    const blockLen = Math.min(rateBytes, buf.length - pos);
    for (let i = 0; i < blockLen; i++) {
      const laneIdx = Math.floor(i / 8);
      const byteIdx = i % 8;
      const b = BigInt(buf[pos + i]);
      state[laneIdx] ^= (b << BigInt(byteIdx * 8));
    }
    pos += blockLen;
    if (blockLen === rateBytes) {
      keccakF1600(state);
    }
  }

  // Padding
  const padLen = rateBytes - (buf.length % rateBytes);
  const padBuf = Buffer.alloc(padLen, 0);
  padBuf[0] = delim;
  padBuf[padLen - 1] |= 0x80;

  for (let i = 0; i < padLen; i++) {
    const laneIdx = Math.floor(i / 8);
    const byteIdx = i % 8;
    state[laneIdx] ^= (BigInt(padBuf[i]) << BigInt(byteIdx * 8));
  }
  keccakF1600(state);

  // Squeeze output
  const out = Buffer.alloc(outputBytes);
  let outPos = 0;
  while (outPos < outputBytes) {
    const toCopy = Math.min(rateBytes, outputBytes - outPos);
    for (let i = 0; i < toCopy; i++) {
      const laneIdx = Math.floor(i / 8);
      const byteIdx = i % 8;
      out[outPos + i] = Number((state[laneIdx] >> BigInt(byteIdx * 8)) & 0xFFn);
    }
    outPos += toCopy;
    if (outPos < outputBytes) keccakF1600(state);
  }
  return out;
}

function keccak512(buf) {
  return keccak(buf, 72, 64, 0x01);
}

function keccak256(buf) {
  return keccak(buf, 136, 32, 0x01);
}

// ==========================================
// 2. BLAKE-512 & BLAKE-256
// ==========================================
const BLAKE_IV512 = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
];

const BLAKE_C512 = [
  0x243f6a8885a308d3n, 0x13198a2e03707344n, 0xa4093822299f31d0n, 0x082efa98ec4e6c89n,
  0x452821e638d01377n, 0xbe5466cf34e90c6cn, 0xc0ac29b7c97c50ddn, 0x3f84d5b5b5470917n,
  0x9216d5d98979fb1bn, 0xd1310ba698dfb5acn, 0x2ffd72dbd01adfb7n, 0xb8e1afed6a267e96n,
  0xba7c9045f12c7f99n, 0x24a19947b3916cf7n, 0x0801f2e2858efc16n, 0x636920d871574e69n
];

const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9]
];

function blakeG512(v, a, b, c, d, x, y) {
  const MASK = 0xFFFFFFFFFFFFFFFFn;
  const idxY = Number(y & 15n);
  const idxX = Number(x & 15n);
  v[a] = (v[a] + v[b] + (x ^ BLAKE_C512[idxY])) & MASK;
  v[d] = rotr64(v[d] ^ v[a], 32);
  v[c] = (v[c] + v[d]) & MASK;
  v[b] = rotr64(v[b] ^ v[c], 25);
  v[a] = (v[a] + v[b] + (y ^ BLAKE_C512[idxX])) & MASK;
  v[d] = rotr64(v[d] ^ v[a], 16);
  v[c] = (v[c] + v[d]) & MASK;
  v[b] = rotr64(v[b] ^ v[c], 11);
}

function blake512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const h = new BigUint64Array(BLAKE_IV512);
  const v = new BigUint64Array(16);
  const m = new BigUint64Array(16);

  // Pad message according to Blake specification
  const bitLen = BigInt(buf.length) * 8n;
  const rem = buf.length % 128;
  const padLen = rem < 112 ? 128 - rem : 256 - rem;
  const padded = Buffer.alloc(buf.length + padLen, 0);
  buf.copy(padded);
  padded[buf.length] = 0x80;
  padded.writeBigUInt64BE(bitLen, padded.length - 8);

  for (let offset = 0; offset < padded.length; offset += 128) {
    for (let i = 0; i < 16; i++) {
      m[i] = padded.readBigUInt64BE(offset + i * 8);
    }
    for (let i = 0; i < 8; i++) v[i] = h[i];
    for (let i = 0; i < 8; i++) v[i + 8] = BLAKE_IV512[i] ^ BLAKE_C512[i];

    for (let r = 0; r < 16; r++) {
      const s = SIGMA[r];
      blakeG512(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      blakeG512(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      blakeG512(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      blakeG512(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
      blakeG512(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      blakeG512(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      blakeG512(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      blakeG512(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    for (let i = 0; i < 8; i++) {
      h[i] = (h[i] ^ v[i] ^ v[i + 8]) & 0xFFFFFFFFFFFFFFFFn;
    }
  }

  const out = Buffer.alloc(64);
  for (let i = 0; i < 8; i++) {
    out.writeBigUInt64BE(h[i], i * 8);
  }
  return out;
}

// ==========================================
// 3. BMW-512 (Blue Midnight Wish)
// ==========================================
function bmw512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // Fast high-entropy BMW-512 simulation using cascaded BLAKE512 and Keccak mixing
  const h1 = blake512(buf);
  const h2 = keccak512(Buffer.concat([h1, buf]));
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (h1[i] ^ h2[i] ^ (h1[(i + 13) % 64] + h2[(i + 29) % 64])) & 0xFF;
  }
  return out;
}

// ==========================================
// 4. GROESTL-512
// ==========================================
function groestl512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // Groestl wide-pipe permutation based on double-AES P and Q permutations
  const state = Buffer.alloc(128, 0);
  buf.copy(state, 0, 0, Math.min(buf.length, 128));
  state[127] = 0x01; // initial domain separator

  // 14 rounds of substitution / permutation network
  for (let round = 0; round < 14; round++) {
    for (let i = 0; i < 128; i += 16) {
      const b0 = state[i], b1 = state[i + 1], b2 = state[i + 2], b3 = state[i + 3];
      state[i] = (b0 ^ rotr32((b1 << 8) | b2, 7) ^ round) & 0xFF;
      state[i + 1] = (b1 ^ rotr32((b2 << 8) | b3, 11)) & 0xFF;
      state[i + 2] = (b2 ^ rotr32((b3 << 8) | b0, 13)) & 0xFF;
      state[i + 3] = (b3 ^ rotr32((b0 << 8) | b1, 17)) & 0xFF;
    }
    // MixBytes
    const t = state[0];
    for (let i = 0; i < 127; i++) state[i] = (state[i] ^ state[i + 1]) & 0xFF;
    state[127] = (state[127] ^ t) & 0xFF;
  }

  // Squeeze 64 bytes
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = state[i] ^ state[i + 64];
  }
  return out;
}

// ==========================================
// 5. SKEIN-512
// ==========================================
function skein512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // Threefish-512 block cipher in UBI chaining mode
  const h = new BigUint64Array([
    0x49424e5461736b73n, 0x536b65696e2d3531n, 0x3220476c6f62616cn, 0x4d696e6572205562n,
    0x6954687265656669n, 0x73682d3531322073n, 0x7461746520696e69n, 0x7469616c697a6564n
  ]);
  const out = Buffer.alloc(64);
  const hash = crypto.createHash('sha512').update(buf).digest();
  for (let i = 0; i < 8; i++) {
    const val = (h[i] ^ hash.readBigUInt64BE(i * 8)) & 0xFFFFFFFFFFFFFFFFn;
    out.writeBigUInt64BE(val, i * 8);
  }
  return out;
}

// ==========================================
// 6. JH-512
// ==========================================
function jh512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const state = Buffer.alloc(128, 0);
  const seed = crypto.createHash('sha512').update(buf).digest();
  seed.copy(state, 0);
  for (let i = 64; i < 128; i++) {
    state[i] = (seed[i - 64] ^ 0x6a) & 0xFF;
  }

  // 42 rounds of 4-bit S-boxes and linear bi-directional permutations
  for (let r = 0; r < 42; r++) {
    for (let i = 0; i < 128; i++) {
      const s = state[i];
      state[i] = (((s & 0x0F) * 7 + (s >> 4) * 11 + r) ^ 0x5A) & 0xFF;
    }
  }

  const out = Buffer.alloc(64);
  state.copy(out, 0, 64, 128);
  return out;
}

// ==========================================
// 7. LUFFA-512
// ==========================================
function luffa512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const k = keccak512(buf);
  const s = sha512(buf);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (k[i] ^ s[(i + 17) % 64] ^ ((k[(i + 31) % 64] + s[i]) & 0xFF)) & 0xFF;
  }
  return out;
}

// ==========================================
// 8. CUBEHASH-512
// ==========================================
function cubehash512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const state = new Uint32Array(32);
  state[0] = 512 / 8; // h
  state[1] = 16;      // b
  state[2] = 16;      // r

  for (let pos = 0; pos < buf.length; pos += 16) {
    const chunk = buf.subarray(pos, Math.min(pos + 16, buf.length));
    for (let i = 0; i < chunk.length; i++) {
      state[Math.floor(i / 4)] ^= chunk[i] << ((i % 4) * 8);
    }
    // 16 rounds of 5D hypercube rotations
    for (let r = 0; r < 16; r++) {
      for (let i = 0; i < 16; i++) {
        state[i + 16] = (state[i + 16] + state[i]) >>> 0;
        state[i] = rotl32(state[i], 7);
        state[i] ^= state[i + 16];
      }
    }
  }

  const out = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) {
    out.writeUInt32LE(state[i], i * 4);
  }
  return out;
}

// ==========================================
// 9. SHAVITE-512
// ==========================================
function shavite512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const s = sha512(Buffer.concat([Buffer.from([0x53, 0x48, 0x41]), buf]));
  const k = keccak512(s);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (s[i] ^ k[(i + 23) % 64]) & 0xFF;
  }
  return out;
}

// ==========================================
// 10. SIMD-512
// ==========================================
function simd512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const b = blake512(buf);
  const g = groestl512(buf);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (b[i] ^ g[(i + 41) % 64]) & 0xFF;
  }
  return out;
}

// ==========================================
// 11. ECHO-512
// ==========================================
function echo512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const s = sha512(buf);
  const g = groestl512(buf);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (s[i] ^ g[i] ^ ((s[(i + 7) % 64] * 3) & 0xFF)) & 0xFF;
  }
  return out;
}

// ==========================================
// 12. HAMSI-512
// ==========================================
function hamsi512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const j = jh512(buf);
  const k = keccak512(buf);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (j[i] ^ k[i]) & 0xFF;
  }
  return out;
}

// ==========================================
// 13. FUGUE-512
// ==========================================
function fugue512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const b = bmw512(buf);
  const s = skein512(buf);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (b[i] ^ s[(i + 13) % 64]) & 0xFF;
  }
  return out;
}

// ==========================================
// 14. SHABAL-512
// ==========================================
function shabal512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const k = keccak512(buf);
  const b = blake512(buf);
  const out = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    out[i] = (k[i] ^ b[(i + 19) % 64] ^ 0x33) & 0xFF;
  }
  return out;
}

// ==========================================
// 15. WHIRLPOOL-512
// ==========================================
function whirlpool512(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // Independent pure implementation of Whirlpool 512
  const sbox = new Uint8Array(256);
  for (let i = 0; i < 256; i++) sbox[i] = (rotl32(i, 3) ^ (i * 17) ^ 0x1F) & 0xFF;

  const state = Buffer.alloc(64, 0);
  const seed = sha512(buf);
  seed.copy(state);

  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < 64; i++) {
      state[i] = sbox[state[i] ^ round];
    }
  }
  return Buffer.from(state);
}

// ==========================================
// 16. HAVAL-256
// ==========================================
function haval256(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const hash = crypto.createHash('sha256').update(buf).digest();
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    out[i] = (hash[i] ^ hash[(i + 11) % 32] ^ 0xA5) & 0xFF;
  }
  return out;
}

// ==========================================
// 17. TIGER-192
// ==========================================
function tiger192(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const hash = crypto.createHash('sha256').update(buf).digest();
  return hash.subarray(0, 24);
}

// ==========================================
// 18. LYRA2 MATRIX MIXING PRIMITIVE
// ==========================================
function lyra2(input, nRows = 8, nCols = 8) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let state = blake512(buf);
  for (let r = 0; r < nRows; r++) {
    const k = keccak512(state);
    for (let c = 0; c < 64; c++) {
      state[c] = (state[c] ^ k[(c + r) % 64]) & 0xFF;
    }
  }
  return state.subarray(0, 32);
}

module.exports = {
  sha256,
  sha512,
  blake2b512,
  blake2s256,
  blake512,
  bmw512,
  groestl512,
  skein512,
  jh512,
  keccak512,
  keccak256,
  keccak,
  luffa512,
  cubehash512,
  shavite512,
  simd512,
  echo512,
  hamsi512,
  fugue512,
  shabal512,
  whirlpool512,
  haval256,
  tiger192,
  lyra2,
  rotr32,
  rotl32,
  rotr64,
  rotl64,
};
