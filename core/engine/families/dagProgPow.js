/**
 * Global Miner - Family 5: DAG / Epoch Memory Progs
 * Covers:
 * - KawPow
 * - FiroPoW
 * - EvrProgPow
 * - ProgPow
 * - ProgPowZ
 * - MeowPow
 * - vProgPoW
 * - Etchash
 * - Ubqhash
 * - Phihash
 * - PearlHash
 * - RinHash
 * - WalaHash
 * - Fphash
 */

const pp = require('../primitives/progpow');

module.exports = {
  kawpow: (hdr, n) => pp.kawpow(hdr, n),
  firopow: (hdr, n) => pp.firopow(hdr, n),
  evrprogpow: (hdr, n) => pp.evrprogpow(hdr, n),
  progpow: (hdr, n) => pp.progpow(hdr, n),
  progpowz: (hdr, n) => pp.progpowz(hdr, n),
  meowpow: (hdr, n) => pp.meowpow(hdr, n),
  vprogpow: (hdr, n) => pp.vprogpow(hdr, n),
  etchash: (hdr, n) => pp.etchash(hdr, n),
  ubqhash: (hdr, n) => pp.ubqhash(hdr, n),
  phihash: (hdr, n) => pp.phihash(hdr, n),
  pearlhash: (hdr, n) => pp.pearlhash(hdr, n),
  rinhash: (hdr, n) => pp.rinhash(hdr, n),
  walahash: (hdr, n) => pp.walahash(hdr, n),
  fphash: (hdr, n) => pp.fphash(hdr, n),
};
