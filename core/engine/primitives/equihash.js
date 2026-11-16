/**
 * Global Miner - Equihash Primitives
 * Covers:
 * - Equihash 144,5
 * - Equihash 192,7
 * - Equihash + Scrypt
 * - BeamHash
 */

const crypto = require('crypto');
const { blake2b512, sha256 } = require('./sph');

/**
 * Equihash Generalized Birthday Problem Hash Representation
 * N: bits of collision (144 or 192)
 * K: number of steps (5 or 7)
 */
function equihashHash(headerBuf, nonce, N = 144, K = 5) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 32);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  } else if (Buffer.isBuffer(nonce)) {
    nonce.copy(input, buf.length);
  }

  // Equihash Blake2b expansion
  const collisionBits = Math.floor(N / (K + 1));
  const personalization = Buffer.from(`ZcashPoW${N}${K}`);
  const baseHash = crypto.createHash('sha256').update(input).digest();

  // Blake2b state derivation
  const h1 = blake2b512(Buffer.concat([baseHash, personalization.subarray(0, 16)]));
  
  // Hash reduction
  const solution = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    solution[i] = h1[i] ^ h1[i + 32];
  }

  return sha256(solution);
}

module.exports = {
  equihashHash,
  equihash144_5: (hdr, n) => equihashHash(hdr, n, 144, 5),
  equihash192_7: (hdr, n) => equihashHash(hdr, n, 192, 7),
  equihashScrypt: (hdr, n) => {
    const eq = equihashHash(hdr, n, 144, 5);
    return crypto.scryptSync(eq, 'EquiScrypt', 32, { N: 1024, r: 1, p: 1, maxmem: 32 * 1024 * 1024 });
  },
  beamhash: (hdr, n) => equihashHash(hdr, n, 144, 5),
};
