/**
 * Global Miner - Family 2: Memory-Hard Memory-Scrypts
 * Covers:
 * - Argon2d
 * - Argon2id
 * - Argon2id Chukwa
 * - Argon2
 * - Balloon
 * - Scrypt-N
 * - ScryptN11
 * - NeoScrypt
 */

const a2 = require('../primitives/argon2');

function attachNonce(headerBuf, nonce) {
  const buf = Buffer.isBuffer(headerBuf) ? headerBuf : Buffer.from(headerBuf);
  const input = Buffer.alloc(buf.length + 4);
  buf.copy(input);
  if (typeof nonce === 'number') {
    input.writeUInt32LE(nonce, buf.length);
  } else if (typeof nonce === 'bigint') {
    input.writeUInt32LE(Number(nonce & 0xFFFFFFFFn), buf.length);
  }
  return input;
}

module.exports = {
  argon2d: (hdr, n) => a2.argon2d(attachNonce(hdr, n)),
  argon2id: (hdr, n) => a2.argon2id(attachNonce(hdr, n)),
  argon2idChukwa: (hdr, n) => a2.argon2idChukwa(attachNonce(hdr, n)),
  argon2: (hdr, n) => a2.argon2(attachNonce(hdr, n)),
  balloon: (hdr, n) => a2.balloon(attachNonce(hdr, n)),
  scryptN: (hdr, n) => a2.scryptN(attachNonce(hdr, n)),
  scryptN11: (hdr, n) => a2.scryptN11(attachNonce(hdr, n)),
  neoscrypt: (hdr, n) => a2.neoscrypt(attachNonce(hdr, n)),
};
