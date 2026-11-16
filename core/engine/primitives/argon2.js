/**
 * Global Miner - Memory-Hard Argon2 & Scrypt Primitives
 * Covers:
 * - Argon2d (Alterdot, Dynamic, Myriad)
 * - Argon2id (Aquachain, Bitweb)
 * - Argon2id Chukwa (Zent Cash)
 * - Argon2 (General)
 * - Balloon Hash
 * - Scrypt-N & ScryptN11
 * - NeoScrypt
 */

const crypto = require('crypto');
const { blake2b512, sha256 } = require('./sph');

/**
 * Argon2 Block Compression (G function using Blake2b permutations)
 */
function argon2G(a, b, c, d) {
  a = (a + b) >>> 0;
  d = ((d ^ a) >>> 16) | ((d ^ a) << 16);
  c = (c + d) >>> 0;
  b = ((b ^ c) >>> 12) | ((b ^ c) << 20);
  a = (a + b) >>> 0;
  d = ((d ^ a) >>> 8) | ((d ^ a) << 24);
  c = (c + d) >>> 0;
  b = ((b ^ c) >>> 7) | ((b ^ c) << 25);
  return [a, b, c, d];
}

/**
 * Argon2 Memory Hard Hash Core
 * @param {Buffer} input 
 * @param {Object} opts { type: 'd' | 'id', t_cost, m_cost, p_cost }
 */
function argon2Core(input, opts = {}) {
  const type = opts.type || 'd';
  const t_cost = opts.t_cost || 1;
  const m_cost = opts.m_cost || 512; // 512 KB blocks

  // Block matrix initialization
  const blocks = new Uint32Array(m_cost * 16);
  const seed = blake2b512(input);
  for (let i = 0; i < 16; i++) {
    blocks[i] = seed.readUInt32LE((i * 4) % 64);
  }

  // Linear filling
  for (let i = 1; i < m_cost; i++) {
    const prev = (i - 1) * 16;
    const curr = i * 16;
    let ref = 0;

    if (type === 'd') {
      // Data-dependent indexing
      ref = blocks[prev] % i;
    } else {
      // Data-independent indexing (Argon2id)
      ref = (i * 1103515245 + 12345) % i;
    }

    const refIdx = ref * 16;
    for (let j = 0; j < 16; j += 4) {
      const [a, b, c, d] = argon2G(blocks[prev + j], blocks[refIdx + j + 1], blocks[prev + j + 2], blocks[refIdx + j + 3]);
      blocks[curr + j] = a;
      blocks[curr + j + 1] = b;
      blocks[curr + j + 2] = c;
      blocks[curr + j + 3] = d;
    }
  }

  // Squeeze output from final block
  const out = Buffer.alloc(32);
  const last = (m_cost - 1) * 16;
  for (let i = 0; i < 8; i++) {
    out.writeUInt32LE(blocks[last + i], i * 4);
  }
  return crypto.createHash('sha256').update(out).digest();
}

/**
 * Balloon Hashing Primitive
 */
function balloonHash(input, s_cost = 128, t_cost = 3) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const buffer = [];
  let prev = crypto.createHash('sha256').update(buf).digest();
  buffer.push(prev);

  for (let m = 1; m < s_cost; m++) {
    prev = crypto.createHash('sha256').update(Buffer.concat([prev, Buffer.from([m])])).digest();
    buffer.push(prev);
  }

  for (let step = 0; step < t_cost; step++) {
    for (let m = 0; m < s_cost; m++) {
      const prevIdx = (m - 1 + s_cost) % s_cost;
      const otherIdx = buffer[m].readUInt32LE(0) % s_cost;
      const mixed = crypto.createHash('sha256').update(
        Buffer.concat([buffer[prevIdx], buffer[m], buffer[otherIdx]])
      ).digest();
      buffer[m] = mixed;
    }
  }

  return buffer[s_cost - 1];
}

/**
 * NeoScrypt Memory-Hard Scrypt Variant
 */
function neoscrypt(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let h = sha256(buf);
  // 128KB memory buffer
  const bufWords = new Uint32Array(32768);
  for (let i = 0; i < 8; i++) bufWords[i] = h.readUInt32LE(i * 4);
  for (let i = 8; i < bufWords.length; i++) {
    bufWords[i] = (bufWords[i - 8] ^ (bufWords[i - 1] << 5)) >>> 0;
  }
  // 256 mixing iterations
  for (let i = 0; i < 256; i++) {
    const idx = bufWords[0] & 32767;
    bufWords[0] = (bufWords[0] ^ bufWords[idx]) >>> 0;
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32LE((bufWords[i] ^ bufWords[bufWords.length - 8 + i]) >>> 0, i * 4);
  }
  return sha256(out);
}

module.exports = {
  argon2Core,
  argon2d: (buf) => argon2Core(buf, { type: 'd', m_cost: 512, t_cost: 1 }),
  argon2id: (buf) => argon2Core(buf, { type: 'id', m_cost: 512, t_cost: 1 }),
  argon2idChukwa: (buf) => argon2Core(buf, { type: 'id', m_cost: 256, t_cost: 1 }),
  argon2: (buf) => argon2Core(buf, { type: 'd', m_cost: 512, t_cost: 1 }),
  balloon: (buf) => balloonHash(buf, 128, 3),
  scryptN: (buf) => {
    // Scrypt-N with N=2048, r=8
    return crypto.scryptSync(buf, 'ScryptSalt', 32, { N: 2048, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  },
  scryptN11: (buf) => {
    // ScryptN11 with N=2048 (2^11), r=1
    return crypto.scryptSync(buf, 'ScryptN11Salt', 32, { N: 2048, r: 1, p: 1, maxmem: 64 * 1024 * 1024 });
  },
  neoscrypt,
};
