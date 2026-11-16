/**
 * Global Miner - Master Algorithm Registry & Hashing Dispatcher
 * Strictly supports EVERY SINGLE ONE of the 133 algorithms from the live API / tree
 * Categorized into the 8 architectural algorithm families:
 *   1. Memory-Hard VMs
 *   2. Memory-Hard Memory-Scrypts
 *   3. Yespower/Yescrypt Family
 *   4. Cascading SPH & Multi-Digest
 *   5. DAG / Epoch Memory Progs
 *   6. HeavyHash & Matrix/Math
 *   7. Equihash & Cuckoo Cycles
 *   8. Specialized PoWs
 */

const vms = require('./families/memoryHardVMs');
const scrypts = require('./families/memoryHardScrypts');
const yespowers = require('./families/yespowerFamily');
const cascading = require('./families/cascadingSPH');
const dags = require('./families/dagProgPow');
const heavy = require('./families/heavyHashMatrix');
const equicuckoo = require('./families/equihashCuckoo');
const specialized = require('./families/specializedPoW');

// Family Constants
const FAMILIES = {
  MEMORY_HARD_VM: 'Memory-Hard VMs',
  MEMORY_HARD_SCRYPT: 'Memory-Hard Memory-Scrypts',
  YESPOWER_FAMILY: 'Yespower/Yescrypt Family',
  CASCADING_SPH: 'Cascading SPH & Multi-Digest',
  DAG_PROGPOW: 'DAG / Epoch Memory Progs',
  HEAVYHASH_MATRIX: 'HeavyHash & Matrix/Math',
  EQUIHASH_CUCKOO: 'Equihash & Cuckoo Cycles',
  SPECIALIZED_POW: 'Specialized PoWs'
};

// Raw Definition List covering all 133 algorithms
const ALGORITHMS_LIST = [
  // 1. Memory-Hard VMs
  { id: 'randomx', name: 'RandomX', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomx },
  { id: 'randomarq', name: 'RandomARQ', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomarq },
  { id: 'randomkeva', name: 'RandomKeva', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomkeva },
  { id: 'randomscash', name: 'RandomSCASH', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomscash },
  { id: 'randomvirel', name: 'RandomVirel', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomvirel },
  { id: 'randomy', name: 'RandomY', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomy },
  { id: 'randomc64', name: 'RandomC64', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.randomc64 },
  { id: 'tarirx', name: 'TariRx', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.tarirx },
  { id: 'monerorx', name: 'MoneroRx', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.monerorx },
  { id: 'panthera', name: 'Panthera', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.panthera },
  { id: 'mike', name: 'Mike', family: FAMILIES.MEMORY_HARD_VM, hw: 'CPU', fn: vms.mike },

  // 2. Memory-Hard Memory-Scrypts
  { id: 'argon2d', name: 'Argon2d', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'CPU', fn: scrypts.argon2d },
  { id: 'argon2id', name: 'Argon2id', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'CPU', fn: scrypts.argon2id },
  { id: 'argon2id-chukwa', name: 'Argon2id Chukwa', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'CPU', fn: scrypts.argon2idChukwa },
  { id: 'argon2', name: 'Argon2', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'GPU', fn: scrypts.argon2 },
  { id: 'balloon', name: 'Balloon', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'GPU', fn: scrypts.balloon },
  { id: 'scrypt-n', name: 'Scrypt-N', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'CPU', fn: scrypts.scryptN },
  { id: 'scryptn11', name: 'ScryptN11', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'GPU', fn: scrypts.scryptN11 },
  { id: 'neoscrypt', name: 'NeoScrypt', family: FAMILIES.MEMORY_HARD_SCRYPT, hw: 'GPU', fn: scrypts.neoscrypt },

  // 3. Yespower/Yescrypt Family
  { id: 'yespower', name: 'YesPoWer', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespower },
  { id: 'yescrypt', name: 'Yescrypt', family: FAMILIES.YESPOWER_FAMILY, hw: 'GPU', fn: yespowers.yescrypt },
  { id: 'yescryptr16', name: 'YescryptR16', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yescryptr16 },
  { id: 'yescryptr32', name: 'YescryptR32', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yescryptr32 },
  { id: 'yescryptr8', name: 'YescryptR8', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yescryptr8 },
  { id: 'yespoweradvc', name: 'YespowerADVC', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespoweradvc },
  { id: 'yespowerltncg', name: 'YespowerLTNCG', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespowerltncg },
  { id: 'yespowermgpc', name: 'YespowerMGPC', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespowermgpc },
  { id: 'yespowerr16', name: 'YespowerR16', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespowerr16 },
  { id: 'yespowersugar', name: 'YespowerSugar', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespowersugar },
  { id: 'yespowertide', name: 'YesPoWerTIDE', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespowertide },
  { id: 'yespowerurx', name: 'YespowerURX', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.yespowerurx },
  { id: 'power2b', name: 'Power2b', family: FAMILIES.YESPOWER_FAMILY, hw: 'CPU', fn: yespowers.power2b },

  // 4. Cascading SPH & Multi-Digest
  { id: 'ghostrider', name: 'GhostRider', family: FAMILIES.CASCADING_SPH, hw: 'CPU', fn: cascading.ghostrider },
  { id: 'minotaurx', name: 'MinotaurX', family: FAMILIES.CASCADING_SPH, hw: 'CPU', fn: cascading.minotaurx },
  { id: 'x16r', name: 'X16R', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.x16r },
  { id: 'x16rt', name: 'X16RT', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.x16rt },
  { id: 'x16rv2', name: 'X16Rv2', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.x16rv2 },
  { id: 'x16rs', name: 'X16RS', family: FAMILIES.CASCADING_SPH, hw: 'CPU', fn: cascading.x16rs },
  { id: 'x17', name: 'X17', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.x17 },
  { id: 'x21s', name: 'X21S', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.x21s },
  { id: 'x25x', name: 'X25X', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.x25x },
  { id: 'tribus', name: 'Tribus', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.tribus },
  { id: 'allium', name: 'Allium', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.allium },
  { id: 'hmq1725', name: 'HMQ1725', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.hmq1725 },
  { id: 'blake2b-sha3', name: 'Blake2B + SHA3', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.blake2bSha3 },
  { id: 'm7m', name: 'M7M', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.m7m },
  { id: 'mega-btx', name: 'Mega-BTX', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.megaBtx },
  { id: 'skydoge', name: 'Skydoge', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.skydoge },
  { id: 'anime', name: 'Anime', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.anime },
  { id: 'vipstar', name: 'Vipstar', family: FAMILIES.CASCADING_SPH, hw: 'CPU', fn: cascading.vipstar },
  { id: 'skein2', name: 'Skein2', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.skein2 },
  { id: 'xhash', name: 'XHash', family: FAMILIES.CASCADING_SPH, hw: 'GPU', fn: cascading.xhash },

  // 5. DAG / Epoch Memory Progs
  { id: 'kawpow', name: 'KawPow', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.kawpow, minVram: 4 },
  { id: 'firopow', name: 'FiroPoW', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.firopow, minVram: 4 },
  { id: 'evrprogpow', name: 'EvrProgPow', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.evrprogpow, minVram: 4 },
  { id: 'progpow', name: 'ProgPow', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.progpow, minVram: 4 },
  { id: 'progpowz', name: 'ProgPowZ', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.progpowz, minVram: 4 },
  { id: 'meowpow', name: 'MeowPow', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.meowpow, minVram: 4 },
  { id: 'vprogpow', name: 'vProgPoW', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.vprogpow, minVram: 4 },
  { id: 'etchash', name: 'Etchash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.etchash, minVram: 4 },
  { id: 'ubqhash', name: 'Ubqhash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.ubqhash, minVram: 4 },
  { id: 'phihash', name: 'Phihash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.phihash, minVram: 4 },
  { id: 'pearlhash', name: 'PearlHash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.pearlhash, minVram: 4 },
  { id: 'rinhash', name: 'RinHash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.rinhash, minVram: 4 },
  { id: 'walahash', name: 'WalaHash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.walahash, minVram: 4 },
  { id: 'fphash', name: 'Fphash', family: FAMILIES.DAG_PROGPOW, hw: 'GPU', fn: dags.fphash, minVram: 4 },

  // 6. HeavyHash & Matrix/Math
  { id: 'kheavyhash', name: 'kHeavyHash', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.kheavyhash },
  { id: 'karlsenhashv2', name: 'KarlsenHashV2', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.karlsenhashv2 },
  { id: 'hoohash', name: 'Hoohash', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.hoohash },
  { id: 'hoohashv110', name: 'HoohashV110', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.hoohashv110 },
  { id: 'heavyhash', name: 'Heavyhash', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.heavyhash },
  { id: 'matmul', name: 'MatMul', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.matmul },
  { id: 'blake3', name: 'Blake3', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.blake3 },
  { id: 'blake2b', name: 'Blake2B', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.blake2b },
  { id: 'blake2s', name: 'Blake2S', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.blake2s },
  { id: 'keccak', name: 'Keccak', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.keccak },
  { id: 'k12', name: 'K12', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.k12 },
  { id: 'sha-3x', name: 'SHA-3X', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'CPU', fn: heavy.sha3x },
  { id: 'sha512256d', name: 'Sha512256D', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.sha512256d },
  { id: 'sha256dv', name: 'SHA256dv', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'CPU', fn: heavy.sha256dv },
  { id: 'sha3-256t', name: 'SHA3-256t', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.sha3_256t },
  { id: 'sha3solidity', name: 'SHA3Solidity', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.sha3solidity },
  { id: 'meerkeccakv1', name: 'MeerKeccakV1', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.meerkeccakv1 },
  { id: 'whirlpool', name: 'Whirlpool', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.whirlpool },
  { id: 'bmw512', name: 'bmw512', family: FAMILIES.HEAVYHASH_MATRIX, hw: 'GPU', fn: heavy.bmw512 },

  // 7. Equihash & Cuckoo Cycles
  { id: 'equihash-144-5', name: 'Equihash 144,5', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.equihash144_5 },
  { id: 'equihash-192-7', name: 'Equihash 192,7', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.equihash192_7 },
  { id: 'equihash-scrypt', name: 'Equihash + Scrypt', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.equihashScrypt },
  { id: 'beamhash', name: 'BeamHash', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.beamhash },
  { id: 'cuckaroo', name: 'Cuckaroo', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.cuckaroo },
  { id: 'cuckaroo29', name: 'Cuckaroo29', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.cuckaroo29 },
  { id: 'cuckatoo31', name: 'Cuckatoo31', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.cuckatoo31 },
  { id: 'cuckatoo32', name: 'Cuckatoo32', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.cuckatoo32 },
  { id: 'cuckoo', name: 'Cuckoo', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.cuckoo },
  { id: 'cuckoo-cycle', name: 'Cuckoo Cycle', family: FAMILIES.EQUIHASH_CUCKOO, hw: 'GPU', fn: equicuckoo.cuckooCycle },

  // 8. Specialized PoWs
  { id: 'autolykos-2', name: 'Autolykos 2', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.autolykos2, minVram: 3 },
  { id: 'autolykos2', name: 'Autolykos2', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.autolykos2, minVram: 3 },
  { id: 'octopus', name: 'Octopus', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.octopus, minVram: 4 },
  { id: 'fishhash', name: 'FishHash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.fishhash, minVram: 4 },
  { id: 'verthash', name: 'Verthash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.verthash, minVram: 2 },
  { id: 'verushash', name: 'VerusHash', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.verushash },
  { id: 'dynexsolve', name: 'DynexSolve', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.dynexsolve },
  { id: 'xelishashv3', name: 'XelishashV3', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.xelishashv3 },
  { id: 'poseidon2-goldilocks', name: 'Poseidon2-Goldilocks', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.poseidon2Goldilocks },
  { id: 'zkpow', name: 'ZKPoW', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.zkpow },
  { id: 'zksnark', name: 'zkSNARK', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.zksnark },
  { id: 'astrobwt-v3', name: 'AstroBWT/v3', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.astrobwtV3 },
  { id: 'curvehash', name: 'Curvehash', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.curvehash },
  { id: 'dpowhash', name: 'Dpowhash', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.dpowhash },
  { id: 'flex', name: 'Flex', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.flex },
  { id: 'neuromorph', name: 'Neuromorph', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.neuromorph },
  { id: 'odocrypt', name: 'Odocrypt', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.odocrypt },
  { id: 'stella', name: 'Stella', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.stella },
  { id: 'upow', name: 'UPoW', family: FAMILIES.SPECIALIZED_POW, hw: 'CPU', fn: specialized.upow },
  { id: 'abelhash', name: 'Abelhash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.abelhash },
  { id: 'bc3hash', name: 'BC3Hash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.bc3hash },
  { id: 'cryptix-ox8', name: 'Cryptix OX8', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.cryptixOx8 },
  { id: 'cryptonight-conceal', name: 'CryptoNight Conceal', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.cryptonightConceal },
  { id: 'cryptonight-gpu', name: 'CryptoNight GPU', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.cryptonightGpu },
  { id: 'cryptonight-lite', name: 'CryptoNight Lite', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.cryptonightLite },
  { id: 'cryptonight-turtle', name: 'CryptoNight Turtle', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.cryptonightTurtle },
  { id: 'cryptonight-upx', name: 'CryptoNight UPX', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.cryptonightUpx },
  { id: 'lyra2mintme', name: 'Lyra2MintMe', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.lyra2Mintme },
  { id: 'lyra2z', name: 'Lyra2z', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.lyra2z },
  { id: 'lyra2z330', name: 'Lyra2z330', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.lyra2z330 },
  { id: 'meraki', name: 'Meraki', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.meraki },
  { id: 'nexapow', name: 'NexaPow', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.nexapow },
  { id: 'nexushash', name: 'NexusHash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.nexushash },
  { id: 'pobw', name: 'PoBW', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.pobw },
  { id: 'poscan', name: 'PoScan', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.poscan },
  { id: 'qhash', name: 'QHash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.qhash },
  { id: 'randomhash', name: 'RandomHash', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.randomhash },
  { id: 'graveyard', name: 'GRAVEYARD', family: FAMILIES.SPECIALIZED_POW, hw: 'GPU', fn: specialized.graveyard },
];

// Build Map for O(1) Fast Lookup with alias normalization
const REGISTRY = new Map();

function normalizeAlgoId(id) {
  if (!id) return '';
  return id.toLowerCase().trim().replace(/[\s\-_/]/g, '');
}

ALGORITHMS_LIST.forEach((algo) => {
  REGISTRY.set(algo.id, algo);
  REGISTRY.set(algo.id.toLowerCase(), algo);
  REGISTRY.set(normalizeAlgoId(algo.id), algo);
  REGISTRY.set(normalizeAlgoId(algo.name), algo);
});

/**
 * Get algorithm definition by any id/name format
 */
function getAlgorithm(idOrName) {
  if (!idOrName) return null;
  const raw = idOrName.toString().trim();
  if (REGISTRY.has(raw)) return REGISTRY.get(raw);
  if (REGISTRY.has(raw.toLowerCase())) return REGISTRY.get(raw.toLowerCase());
  const norm = normalizeAlgoId(raw);
  if (REGISTRY.has(norm)) return REGISTRY.get(norm);
  return null;
}

/**
 * Check if a hash matches target difficulty
 * @param {Buffer} hashBuf 32-byte digest buffer
 * @param {Buffer|BigInt|string} target 32-byte target or hex string
 * @param {boolean} littleEndian Whether to evaluate in little-endian order
 */
function meetsTarget(hashBuf, target, littleEndian = true) {
  let targetVal;
  if (typeof target === 'bigint') {
    targetVal = target;
  } else if (Buffer.isBuffer(target)) {
    targetVal = BigInt('0x' + (littleEndian ? Buffer.from(target).reverse().toString('hex') : target.toString('hex')));
  } else if (typeof target === 'string') {
    const clean = target.startsWith('0x') ? target.slice(2) : target;
    targetVal = BigInt('0x' + clean);
  } else if (typeof target === 'number') {
    targetVal = BigInt(target);
  } else {
    return false;
  }

  const hashVal = BigInt('0x' + (littleEndian ? Buffer.from(hashBuf).reverse().toString('hex') : hashBuf.toString('hex')));
  return hashVal <= targetVal;
}

module.exports = {
  FAMILIES,
  ALGORITHMS_LIST,
  REGISTRY,
  getAlgorithm,
  meetsTarget,
  normalizeAlgoId,
  count: ALGORITHMS_LIST.length
};
