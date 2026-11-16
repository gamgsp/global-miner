# Global Miner

[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-blue.svg)](https://github.com/gamgsp/global-miner)
[![Algorithms](https://img.shields.io/badge/Algorithms-133%20Native%20Supported-purple.svg)](https://api.globalminer.top/api/v1/tree)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stratum](https://img.shields.io/badge/Stratum-Zero--Downtime%20Failover-cyan.svg)](https://api.globalminer.top)
[![Rebates](https://img.shields.io/badge/Mining%20Rebates-GSPC%20InstantSend-gold.svg)](https://gspcoin.us)

Proprietary cross-platform cryptocurrency mining engine natively supporting all **133 algorithms** listed on the live Global Miner tree network ([https://api.globalminer.top/api/v1/tree](https://api.globalminer.top/api/v1/tree)). Features a native multi-threaded hashing engine, native TCP/TLS Stratum client, zero-downtime hot failover, 1-minute/hour dev-fee mining, and automated GSPC mining rebate accrual.

---

## Key Features

- **Strictly Proprietary Native Engine**: No external miner binaries (no xmrig, no srbminer). Native multi-threaded hashing dispatcher.
- **133 Native Algorithms Supported**:
  - **Memory-Hard VMs**: RandomX, RandomARQ, RandomKeva, RandomSCASH, RandomVirel, RandomY, RandomC64, TariRx, MoneroRx, Panthera, Mike.
  - **Memory-Hard Memory-Scrypts**: Argon2d, Argon2id, Argon2id Chukwa, Argon2, Balloon, Scrypt-N, ScryptN11, NeoScrypt.
  - **Yespower/Yescrypt Family**: Yespower, Yescrypt, YescryptR16, YescryptR32, YescryptR8, YespowerADVC, YespowerLTNCG, YespowerMGPC, YespowerR16, YespowerSugar, YesPoWerTIDE, YespowerURX, Power2b.
  - **Cascading SPH & Multi-Digest**: GhostRider, MinotaurX, X16R, X16RT, X16Rv2, X16RS, X17, X21S, X25X, Tribus, Allium, HMQ1725, Blake2B+SHA3, M7M, Mega-BTX, Skydoge, Anime, Vipstar, Skein2, XHash.
  - **DAG / Epoch Memory Progs**: KawPow, FiroPoW, EvrProgPow, ProgPow, ProgPowZ, MeowPow, vProgPoW, Etchash, Ubqhash, Phihash, PearlHash, RinHash, WalaHash, Fphash.
  - **HeavyHash & Matrix/Math**: kHeavyHash, KarlsenHashV2, Hoohash, HoohashV110, Heavyhash, MatMul, Blake3, Blake2B, Blake2S, Keccak, K12, SHA-3X, Sha512256D, SHA256dv, SHA3-256t, SHA3Solidity, MeerKeccakV1, Whirlpool, bmw512.
  - **Equihash & Cuckoo Cycles**: Equihash 144,5, Equihash 192,7, Equihash + Scrypt, BeamHash, Cuckaroo, Cuckaroo29, Cuckatoo31, Cuckatoo32, Cuckoo, Cuckoo Cycle.
  - **Specialized PoWs**: Autolykos 2, Autolykos2, Octopus, FishHash, Verthash, VerusHash, DynexSolve, XelishashV3, Poseidon2-Goldilocks, ZKPoW, zkSNARK, AstroBWT/v3, Curvehash, Dpowhash, Flex, Neuromorph, Odocrypt, Stella, UPoW, Abelhash, BC3Hash, Cryptix OX8, CryptoNight (Conceal, GPU, Lite, Turtle, UPX), NexaPow, NexusHash, PoBW, PoScan, QHash, RandomHash, Graveyard, Lyra2MintMe, Lyra2z, Lyra2z330, Meraki.
- **Dynamic Cloud Tree Synchronization**: Queries `https://api.globalminer.top/api/v1/tree` in real-time with multi-tier disk caching and offline fallback.
- **Native Stratum Client**: Direct TCP/TLS socket client supporting Stratum v1/v2, CryptoNote, Ethash, and ProgPow job structures.
- **Zero-Downtime Hot Failover**: Seamlessly fails over to secondary pools on connection loss and automatically returns when primary recovers.
- **1-Min/Hour Dev-Fee with GSPC Rebates**: Transmits heartbeats to `https://api.globalminer.top/api/v1/miner/heartbeat` and returns 100% GSPC rebate credits.
- **Dual Interface**:
  - **Interactive CLI & Headless Daemon**: Wizard setup, CLI flags, systemd/launchd/task scheduler service management.
  - **Modern Desktop GUI**: Electron dashboard with canvas hashrate charts, pool ping monitor, and rebate counter.
- **Cross-Platform Packaging**: Automated build scripts for Linux (`.deb` & `.AppImage`), Windows (`.exe` & zip), and macOS (`.dmg`).

---

## Directory Structure

```
global-miner/
├── core/
│   ├── engine/                    # Proprietary multi-threaded hashing engine
│   │   ├── primitives/            # Cryptographic primitives (SPH, CN, RandomX, Yespower, Argon2, ProgPow, HeavyHash, Equihash, Cuckoo)
│   │   ├── families/              # 8 Modular algorithm family dispatchers
│   │   ├── registry.js            # Master Algorithm Registry (133 algorithms)
│   │   ├── miner.js               # Proprietary Mining Engine
│   │   └── workerThread.js        # Multi-threaded CPU worker loop
│   ├── stratumClient.js           # Native Stratum v1/v2 client with hot failover & dev-fee
│   ├── apiSync.js                 # API tree sync & GSPC rebate heartbeat
│   └── hardware.js                # Hardware auto-detection
├── cli/
│   ├── index.js                   # Interactive wizard & headless CLI runner
│   └── autoStart.js               # Service installer (systemd, schtasks, launchd)
├── gui/                           # Electron Desktop GUI
│   ├── main.js                    # Electron main process
│   ├── preload.js                 # IPC bridge
│   ├── renderer.js                # Canvas hashrate chart & UI logic
│   └── index.html                 # Modern cyberpunk dark theme
├── build-scripts/
│   ├── build-linux.sh             # Linux .deb & .AppImage builder
│   ├── build-windows.sh           # Windows x64 zip & launcher builder
│   ├── build-mac.sh               # macOS .dmg & .app builder
│   └── build-all.js               # Multi-platform master build runner
├── test/
│   └── simulator.js               # Comprehensive 133-algo & stratum simulator
└── package.json
```

---

## Quick Start

### 1. Run Verification Test
```bash
node cli/index.js --test
# Or run the full Stratum Simulator test suite:
node test/simulator.js
```

### 2. Interactive Terminal Setup
```bash
node cli/index.js
```

### 3. CLI Direct Flags
```bash
node cli/index.js --algo randomx --coin XMR --pool pool.supportxmr.com:3333 --wallet <YOUR_WALLET> --threads 8 --gspc <YOUR_GSPC_ADDRESS>
```

### 4. Background Service Installation
```bash
# Linux (systemd)
node cli/autoStart.js install
# Check status
node cli/autoStart.js status
```

### 5. Desktop GUI
```bash
npm run gui
```

### 6. Build Packages
```bash
# Build for all platforms:
npm run build:all

# Or build platform specifically:
npm run build:linux
npm run build:win
npm run build:mac
```

---

## License

MIT © Global Ads Media, LLC
