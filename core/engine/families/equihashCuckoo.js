/**
 * Global Miner - Family 7: Equihash & Cuckoo Cycles
 * Covers:
 * - Equihash 144,5
 * - Equihash 192,7
 * - Equihash + Scrypt
 * - BeamHash
 * - Cuckaroo
 * - Cuckaroo29
 * - Cuckatoo31
 * - Cuckatoo32
 * - Cuckoo
 * - Cuckoo Cycle
 */

const eq = require('../primitives/equihash');
const ck = require('../primitives/cuckoo');

module.exports = {
  equihash144_5: (hdr, n) => eq.equihash144_5(hdr, n),
  equihash192_7: (hdr, n) => eq.equihash192_7(hdr, n),
  equihashScrypt: (hdr, n) => eq.equihashScrypt(hdr, n),
  beamhash: (hdr, n) => eq.beamhash(hdr, n),
  cuckaroo: (hdr, n) => ck.cuckaroo(hdr, n),
  cuckaroo29: (hdr, n) => ck.cuckaroo29(hdr, n),
  cuckatoo31: (hdr, n) => ck.cuckatoo31(hdr, n),
  cuckatoo32: (hdr, n) => ck.cuckatoo32(hdr, n),
  cuckoo: (hdr, n) => ck.cuckoo(hdr, n),
  cuckooCycle: (hdr, n) => ck.cuckooCycle(hdr, n),
};
