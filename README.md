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

---

## 🏢 Parent Company & Commercial Subsidiaries Matrix

Proudly engineered, operated, and maintained under the digital infrastructure and technology umbrella of **Global Ads Media, LLC**.

### Global Ads Media, LLC (Parent Organization)
<p align="center">
  <a href="https://globaladsmedia.us" target="_blank" rel="noopener noreferrer">
    <img src="https://github.com/gamgsp/globaldata/blob/main/Global%20Ads%20Media/globaladsmedia-black-1024-300.png?raw=true" alt="Global Ads Media, LLC" width="280" />
  </a>
</p>

* **Website:** <a href="https://globaladsmedia.us" target="_blank" rel="noopener noreferrer">https://globaladsmedia.us</a>
* **Sector:** Enterprise Digital Marketing, AdTech Infrastructure & Global Traffic Aggregation
* **Overview:** Global Ads Media operates automated programmatic advertising, high-volume Real-Time Bidding (RTB), and audience segmentation engines, linking next-generation web technologies, fintech, and digital media platforms into a unified commercial ecosystem.

---

### Commercial Subsidiaries

<table>
  <thead>
    <tr>
      <th width="200">Subsidiary</th>
      <th width="140">Sector</th>
      <th>Commercial Description & Official Website</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center">
        <a href="https://1dollarcloud.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/1dollarcloud/1dollarcloud-black-1024-210.png?raw=true" alt="1 Dollar Cloud" width="140" /><br />
          <strong>1 Dollar Cloud</strong>
        </a>
      </td>
      <td><strong>Cloud & Hosting</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://1dollarcloud.com" target="_blank" rel="noopener noreferrer">1dollarcloud.com</a><br />
        Affordable, high-performance NVMe cloud hosting, Cloud VPS, dedicated infrastructure, and domain registration starting at just $1 per month.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://gspcoin.us" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/GSP%20Coin/gspcname%201024x452%20black.png?raw=true" alt="GSP Coin" width="140" /><br />
          <strong>GSP Coin</strong>
        </a>
      </td>
      <td><strong>Layer-1 Blockchain</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://gspcoin.us" target="_blank" rel="noopener noreferrer">gspcoin.us</a><br />
        An enterprise-grade, decentralized Layer-1 cryptocurrency designed for global commercial transactions, high-yield Smartnodes, and AdTech settlement.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://gspcexchange.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/GSPC%20Exchange/gspcexc-dark-logo.png?raw=true" alt="GSPC Exchange" width="140" /><br />
          <strong>GSPC Exchange</strong>
        </a>
      </td>
      <td><strong>DeFi & P2P Trading</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://gspcexchange.com" target="_blank" rel="noopener noreferrer">gspcexchange.com</a><br />
        A secure, non-custodial P2P cryptocurrency escrow exchange featuring automated order matching, multi-chain settlement, and zero middleman risk.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://1url.my" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/1url/1url-black-1024-380.png?raw=true" alt="1url" width="140" /><br />
          <strong>1url</strong>
        </a>
      </td>
      <td><strong>Enterprise SaaS</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://1url.my" target="_blank" rel="noopener noreferrer">1url.my</a><br />
        A high-performance URL shortening and link management service that allows businesses and individuals to create custom, branded, and trackable smart links.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://globaltradepulse.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Global%20Trade%20Pulse/gtp-logo-black.png?raw=true" alt="Global Trade Pulse" width="140" /><br />
          <strong>Global Trade Pulse</strong>
        </a>
      </td>
      <td><strong>Quantitative Intelligence</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://globaltradepulse.com" target="_blank" rel="noopener noreferrer">globaltradepulse.com</a><br />
        An algorithmic financial intelligence and multi-market scanner platform providing real-time technical analysis across US equities, Indian markets, gold, and forex.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://worldnewsguru.us" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/World%20News%20Guru/wnglogo-black-1024-330.png?raw=true" alt="World News Guru" width="140" /><br />
          <strong>World News Guru</strong>
        </a>
      </td>
      <td><strong>Global Journalism</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://worldnewsguru.us" target="_blank" rel="noopener noreferrer">worldnewsguru.us</a><br />
        A premier digital media platform that aggregates news from multiple verified global sources in a comprehensive, fast, and unbiased manner.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://globalcricinfo.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Global%20Cric%20Info/global%20cric%20info%20logo%20black.png?raw=true" alt="Global Cric Info" width="140" /><br />
          <strong>Global Cric Info</strong>
        </a>
      </td>
      <td><strong>Sports Media</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://globalcricinfo.com" target="_blank" rel="noopener noreferrer">globalcricinfo.com</a><br />
        An international sports media portal offering real-time ball-by-ball updates on cricket scores, breaking tournament news, schedules, and player telemetry.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://globalsocialpost.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Global%20Social%20Post/globalsocialpost-black-1024-300.png?raw=true" alt="Global Social Post" width="140" /><br />
          <strong>Global Social Post</strong>
        </a>
      </td>
      <td><strong>Social Automation</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://globalsocialpost.com" target="_blank" rel="noopener noreferrer">globalsocialpost.com</a><br />
        An omni-channel social media automation platform that allows businesses and agencies to design, schedule, and automate posts across multiple channels simultaneously.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://globalsmtpmail.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Global%20Smtp%20Mail/gsm-black-1024-320.png?raw=true" alt="Global SMTP Mail" width="140" /><br />
          <strong>Global SMTP Mail</strong>
        </a>
      </td>
      <td><strong>Email Infrastructure</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://globalsmtpmail.com" target="_blank" rel="noopener noreferrer">globalsmtpmail.com</a><br />
        A reliable, high-throughput email delivery service and enterprise SMTP relay infrastructure that guarantees superior inbox deliverability rates.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://globalintelinvest.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Global%20Intel%20Invest/glob_int_inv_black_logo.png?raw=true" alt="Global Intel Invest" width="140" /><br />
          <strong>Global Intel Invest</strong>
        </a>
      </td>
      <td><strong>Financial Insights</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://globalintelinvest.com" target="_blank" rel="noopener noreferrer">globalintelinvest.com</a><br />
        An intelligent investment research platform delivering real-time economic data, institutional market analysis, and actionable macroeconomic insights.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://traffixpert.com" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Traffixpert/traffixpert-black-1024-410.png?raw=true" alt="Traffixpert" width="140" /><br />
          <strong>Traffixpert</strong>
        </a>
      </td>
      <td><strong>AdTech & Traffic</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://traffixpert.com" target="_blank" rel="noopener noreferrer">traffixpert.com</a><br />
        A performance digital marketing network that connects web publishers and advertisers to drive high-converting, targeted organic and paid traffic.
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://tryyourluck.today" target="_blank" rel="noopener noreferrer">
          <img src="https://github.com/gamgsp/globaldata/blob/main/Try%20Your%20Luck/tryyourluck-logo.png?raw=true" alt="Try Your Luck" width="140" /><br />
          <strong>Try Your Luck</strong>
        </a>
      </td>
      <td><strong>Digital Goods & Draws</strong></td>
      <td>
        <strong>Website:</strong> <a href="https://tryyourluck.today" target="_blank" rel="noopener noreferrer">tryyourluck.today</a><br />
        A modern digital marketplace offering $1.00 utility software and digital downloads bundled with bonus tickets into provably fair prize draws.
      </td>
    </tr>
  </tbody>
</table>

