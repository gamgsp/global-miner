/**
 * Global Miner - Family 8: Specialized PoWs
 * Covers:
 * - Autolykos 2 & Autolykos2
 * - Octopus
 * - FishHash
 * - Verthash
 * - VerusHash
 * - DynexSolve
 * - XelishashV3
 * - Poseidon2-Goldilocks
 * - ZKPoW & zkSNARK
 * - AstroBWT/v3
 * - Curvehash
 * - Dpowhash, Flex, Neuromorph, Odocrypt, Stella, UPoW, Abelhash, BC3Hash
 * - Cryptix OX8, NexaPow, NexusHash, PoBW, PoScan, QHash, RandomHash, Graveyard, Meraki
 * - Lyra2MintMe, Lyra2z, Lyra2z330
 * - CryptoNight variants (Conceal, GPU, Lite, Turtle, UPX)
 */

const sp = require('../primitives/specialized');
const cn = require('../primitives/cryptonight');

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
  autolykos2: (hdr, n) => sp.autolykos2(hdr, n),
  autolykos_2: (hdr, n) => sp.autolykos2(hdr, n),
  octopus: (hdr, n) => sp.octopus(hdr, n),
  fishhash: (hdr, n) => sp.fishhash(hdr, n),
  verthash: (hdr, n) => sp.verthash(hdr, n),
  verushash: (hdr, n) => sp.verushash(hdr, n),
  dynexsolve: (hdr, n) => sp.dynexsolve(hdr, n),
  xelishashv3: (hdr, n) => sp.xelishashv3(hdr, n),
  poseidon2Goldilocks: (hdr, n) => sp.poseidon2Goldilocks(hdr, n),
  zkpow: (hdr, n) => sp.zkProofHash(hdr, n),
  zksnark: (hdr, n) => sp.zkProofHash(hdr, n),
  astrobwtV3: (hdr, n) => sp.astrobwtV3(hdr, n),
  curvehash: (hdr, n) => sp.curvehash(hdr, n),
  dpowhash: (hdr, n) => sp.dpowhash(hdr, n),
  flex: (hdr, n) => sp.flex(hdr, n),
  neuromorph: (hdr, n) => sp.neuromorph(hdr, n),
  odocrypt: (hdr, n) => sp.odocrypt(hdr, n),
  stella: (hdr, n) => sp.stella(hdr, n),
  upow: (hdr, n) => sp.upow(hdr, n),
  abelhash: (hdr, n) => sp.abelhash(hdr, n),
  bc3hash: (hdr, n) => sp.bc3hash(hdr, n),
  cryptixOx8: (hdr, n) => sp.cryptixOx8(hdr, n),
  cryptonightConceal: (hdr, n) => cn.cnConceal(attachNonce(hdr, n)),
  cryptonightGpu: (hdr, n) => cn.cnGpu(attachNonce(hdr, n)),
  cryptonightLite: (hdr, n) => cn.cnLite(attachNonce(hdr, n)),
  cryptonightTurtle: (hdr, n) => cn.cnTurtle(attachNonce(hdr, n)),
  cryptonightUpx: (hdr, n) => cn.cnUpx(attachNonce(hdr, n)),
  lyra2Mintme: (hdr, n) => sp.lyra2Mintme(hdr, n),
  lyra2z: (hdr, n) => sp.lyra2z(hdr, n),
  lyra2z330: (hdr, n) => sp.lyra2z330(hdr, n),
  meraki: (hdr, n) => sp.meraki(hdr, n),
  nexapow: (hdr, n) => sp.nexapow(hdr, n),
  nexushash: (hdr, n) => sp.nexushash(hdr, n),
  pobw: (hdr, n) => sp.pobw(hdr, n),
  poscan: (hdr, n) => sp.poscan(hdr, n),
  qhash: (hdr, n) => sp.qhash(hdr, n),
  randomhash: (hdr, n) => sp.randomhash(hdr, n),
  graveyard: (hdr, n) => sp.graveyard(hdr, n),
};
