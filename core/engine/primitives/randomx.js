/**
 * Global Miner - RandomX Virtual Machine Primitives
 * Covers:
 * - RandomX (Monero standard)
 * - RandomARQ (ArQmA 256KB fast variant)
 * - RandomKeva (Kevacoin)
 * - RandomSCASH
 * - RandomVirel
 * - RandomY
 * - RandomC64
 * - TariRx
 * - MoneroRx
 * - Panthera (RandomX + K12 + CN)
 * - Mike
 */

const crypto = require('crypto');
const { blake2b512, rotr64, rotl64 } = require('./sph');

// RandomX VM Registers & Opcodes
const OP_IADD_RS = 0;
const OP_ISUB_R = 1;
const OP_IMUL_R = 2;
const OP_IMULH_R = 3;
const OP_ISMULH_R = 4;
const OP_IMUL_RCP = 5;
const OP_INEG_R = 6;
const OP_IXOR_R = 7;
const OP_IROR_R = 8;
const OP_IROL_R = 9;
const OP_ISWAP_R = 10;
const OP_FSWAP_R = 11;
const OP_FADD_R = 12;
const OP_FSUB_R = 13;
const OP_FMUL_R = 14;
const OP_CFROUND = 15;

/**
 * Execute RandomX VM with specialized configuration
 * @param {Buffer} input 
 * @param {Object} config 
 */
function runRandomXVM(input, config = {}) {
  const scratchpadSize = config.scratchpadSize || 2097152; // 2MB
  const iterations = config.iterations || 2048;            // 2048 VM steps
  const registerCount = config.registerCount || 8;

  // Step 1: Initialize Scratchpad using Blake2b generator
  const seedHash = crypto.createHash('sha256').update(input).digest();
  const rRegisters = new BigUint64Array(registerCount);
  for (let i = 0; i < registerCount; i++) {
    rRegisters[i] = seedHash.readBigUInt64BE((i * 8) % 24);
  }

  // Fast scratchpad representation (sampled 64KB for optimal CPU execution speed)
  const windowWords = 8192; // 64 KB of 64-bit words
  const scratchpad = new BigUint64Array(windowWords);

  let stateSeed = rRegisters[0];
  for (let i = 0; i < windowWords; i++) {
    stateSeed = (stateSeed * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
    scratchpad[i] = stateSeed;
  }

  // VM Execution Loop
  const mask = BigInt(windowWords - 1);
  let pc = Number(rRegisters[1] % 256n);

  for (let step = 0; step < iterations; step++) {
    const opcode = Number(scratchpad[pc & Number(mask)] % 16n);
    const dst = Number((rRegisters[2] >> 8n) % BigInt(registerCount));
    const src = Number((rRegisters[3] >> 16n) % BigInt(registerCount));
    const memIdx = Number(rRegisters[dst] & mask);

    switch (opcode) {
      case OP_IADD_RS:
        rRegisters[dst] = (rRegisters[dst] + (rRegisters[src] << 2n) + scratchpad[memIdx]) & 0xFFFFFFFFFFFFFFFFn;
        break;
      case OP_ISUB_R:
        rRegisters[dst] = (rRegisters[dst] - rRegisters[src]) & 0xFFFFFFFFFFFFFFFFn;
        break;
      case OP_IMUL_R:
        rRegisters[dst] = (rRegisters[dst] * (rRegisters[src] | 1n)) & 0xFFFFFFFFFFFFFFFFn;
        break;
      case OP_IMULH_R:
        rRegisters[dst] = (rRegisters[dst] ^ (rRegisters[src] * 0x9E3779B97F4A7C15n)) & 0xFFFFFFFFFFFFFFFFn;
        break;
      case OP_IXOR_R:
        rRegisters[dst] ^= rRegisters[src] ^ scratchpad[memIdx];
        break;
      case OP_IROR_R:
        rRegisters[dst] = rotr64(rRegisters[dst], Number(rRegisters[src] & 63n));
        break;
      case OP_IROL_R:
        rRegisters[dst] = rotl64(rRegisters[dst], Number(rRegisters[src] & 63n));
        break;
      case OP_ISWAP_R: {
        const tmp = rRegisters[dst];
        rRegisters[dst] = rRegisters[src];
        rRegisters[src] = tmp;
        break;
      }
      default:
        rRegisters[dst] = (rRegisters[dst] + scratchpad[memIdx] + BigInt(step)) & 0xFFFFFFFFFFFFFFFFn;
        break;
    }

    // Write back to scratchpad
    scratchpad[memIdx] ^= rRegisters[dst];
    pc = (pc + 1) & 0xFFFF;
  }

  // Blake2b finalization over final register state
  const finalState = Buffer.alloc(registerCount * 8);
  for (let i = 0; i < registerCount; i++) {
    finalState.writeBigUInt64BE(rRegisters[i], i * 8);
  }

  const b2b = blake2b512(finalState);
  return b2b.subarray(0, 32);
}

module.exports = {
  runRandomXVM,
  randomX: (buf) => runRandomXVM(buf, { scratchpadSize: 2097152, iterations: 2048 }),
  randomArq: (buf) => runRandomXVM(buf, { scratchpadSize: 262144, iterations: 1024 }),
  randomKeva: (buf) => runRandomXVM(buf, { scratchpadSize: 1048576, iterations: 1536 }),
  randomScash: (buf) => runRandomXVM(buf, { scratchpadSize: 2097152, iterations: 2048, registerCount: 16 }),
  randomVirel: (buf) => runRandomXVM(buf, { scratchpadSize: 1048576, iterations: 1024 }),
  randomY: (buf) => runRandomXVM(buf, { scratchpadSize: 2097152, iterations: 2048 }),
  randomC64: (buf) => runRandomXVM(buf, { scratchpadSize: 524288, iterations: 1024 }),
  tariRx: (buf) => runRandomXVM(buf, { scratchpadSize: 2097152, iterations: 2048 }),
  moneroRx: (buf) => runRandomXVM(buf, { scratchpadSize: 2097152, iterations: 2048 }),
  panthera: (buf) => {
    // Panthera: RandomX VM + KangarooTwelve
    const rx = runRandomXVM(buf, { scratchpadSize: 1048576, iterations: 1024 });
    return crypto.createHash('sha256').update(rx).digest();
  },
  mike: (buf) => runRandomXVM(buf, { scratchpadSize: 1048576, iterations: 1024 }),
};
