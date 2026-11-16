/**
 * Global Miner - Family 1: Memory-Hard VMs
 * Covers:
 * - RandomX
 * - RandomARQ
 * - RandomKeva
 * - RandomSCASH
 * - RandomVirel
 * - RandomY
 * - RandomC64
 * - TariRx
 * - MoneroRx
 * - Panthera
 * - Mike
 */

const rx = require('../primitives/randomx');

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
  randomx: (hdr, n) => rx.randomX(attachNonce(hdr, n)),
  randomarq: (hdr, n) => rx.randomArq(attachNonce(hdr, n)),
  randomkeva: (hdr, n) => rx.randomKeva(attachNonce(hdr, n)),
  randomscash: (hdr, n) => rx.randomScash(attachNonce(hdr, n)),
  randomvirel: (hdr, n) => rx.randomVirel(attachNonce(hdr, n)),
  randomy: (hdr, n) => rx.randomY(attachNonce(hdr, n)),
  randomc64: (hdr, n) => rx.randomC64(attachNonce(hdr, n)),
  tarirx: (hdr, n) => rx.tariRx(attachNonce(hdr, n)),
  monerorx: (hdr, n) => rx.moneroRx(attachNonce(hdr, n)),
  panthera: (hdr, n) => rx.panthera(attachNonce(hdr, n)),
  mike: (hdr, n) => rx.mike(attachNonce(hdr, n)),
};
