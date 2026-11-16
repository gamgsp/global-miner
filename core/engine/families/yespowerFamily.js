/**
 * Global Miner - Family 3: Yespower / Yescrypt Family
 * Covers:
 * - Yespower
 * - Yescrypt
 * - YescryptR16
 * - YescryptR32
 * - YescryptR8
 * - YespowerADVC
 * - YespowerLTNCG
 * - YespowerMGPC
 * - YespowerR16
 * - YespowerSugar
 * - YesPoWerTIDE
 * - YespowerURX
 * - Power2b
 */

const yp = require('../primitives/yespower');

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
  yespower: (hdr, n) => yp.yespower(attachNonce(hdr, n)),
  yescrypt: (hdr, n) => yp.yescrypt(attachNonce(hdr, n)),
  yescryptr16: (hdr, n) => yp.yescryptR16(attachNonce(hdr, n)),
  yescryptr32: (hdr, n) => yp.yescryptR32(attachNonce(hdr, n)),
  yescryptr8: (hdr, n) => yp.yescryptR8(attachNonce(hdr, n)),
  yespoweradvc: (hdr, n) => yp.yespowerAdvc(attachNonce(hdr, n)),
  yespowerltncg: (hdr, n) => yp.yespowerLtncg(attachNonce(hdr, n)),
  yespowermgpc: (hdr, n) => yp.yespowerMgpc(attachNonce(hdr, n)),
  yespowerr16: (hdr, n) => yp.yespowerR16(attachNonce(hdr, n)),
  yespowersugar: (hdr, n) => yp.yespowerSugar(attachNonce(hdr, n)),
  yespowertide: (hdr, n) => yp.yespowerTide(attachNonce(hdr, n)),
  yespowerurx: (hdr, n) => yp.yespowerUrx(attachNonce(hdr, n)),
  power2b: (hdr, n) => yp.power2b(attachNonce(hdr, n)),
};
