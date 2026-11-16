/**
 * Global Miner - Family 6: HeavyHash & Matrix / Math
 * Covers:
 * - kHeavyHash
 * - KarlsenHashV2
 * - Hoohash & HoohashV110
 * - Heavyhash
 * - MatMul
 * - Blake3
 * - Blake2B
 * - Blake2S
 * - Keccak
 * - K12
 * - SHA-3X
 * - Sha512256D
 * - SHA256dv
 * - SHA3-256t
 * - SHA3Solidity
 * - MeerKeccakV1
 * - Whirlpool
 * - bmw512
 */

const hh = require('../primitives/heavyhash');

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
  kheavyhash: (hdr, n) => hh.kheavyhash(hdr, n),
  karlsenhashv2: (hdr, n) => hh.karlsenhashv2(hdr, n),
  hoohash: (hdr, n) => hh.hoohash(hdr, n),
  hoohashv110: (hdr, n) => hh.hoohashv110(hdr, n),
  heavyhash: (hdr, n) => hh.heavyhash(hdr, n),
  matmul: (hdr, n) => hh.matmul(hdr, n),
  blake3: (hdr, n) => hh.blake3(attachNonce(hdr, n)),
  blake2b: (hdr, n) => hh.blake2b(attachNonce(hdr, n)),
  blake2s: (hdr, n) => hh.blake2s(attachNonce(hdr, n)),
  keccak: (hdr, n) => hh.keccak(attachNonce(hdr, n)),
  k12: (hdr, n) => hh.k12(attachNonce(hdr, n)),
  sha3x: (hdr, n) => hh.sha3x(attachNonce(hdr, n)),
  sha512256d: (hdr, n) => hh.sha512256d(attachNonce(hdr, n)),
  sha256dv: (hdr, n) => hh.sha256dv(attachNonce(hdr, n)),
  sha3_256t: (hdr, n) => hh.sha3_256t(attachNonce(hdr, n)),
  sha3solidity: (hdr, n) => hh.sha3solidity(attachNonce(hdr, n)),
  meerkeccakv1: (hdr, n) => hh.meerkeccakv1(attachNonce(hdr, n)),
  whirlpool: (hdr, n) => hh.whirlpool(attachNonce(hdr, n)),
  bmw512: (hdr, n) => hh.bmw512(attachNonce(hdr, n)),
};
