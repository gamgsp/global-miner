# Global Miner Client

[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-blue.svg)](https://github.com/gamgsp/global-miner)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stratum](https://img.shields.io/badge/Stratum-Zero--Downtime%20Failover-cyan.svg)](https://api.globalminer.top)
[![Rebates](https://img.shields.io/badge/Mining%20Rebates-GSPCoin%20InstantSend-gold.svg)](https://gspcoin.us)

Universal multi-platform cryptocurrency mining client with zero-downtime stratum failover, intelligent hardware auto-detection (CPU cores, threads, L3 cache, GPU VRAM), dynamic cloud stratum pool catalogs, and automated GSPC mining rebates.

---

## Key Features

- **Multi-Platform Support**: Full native support for **Linux**, **Windows**, and **macOS**.
- **Dual Interface Modes**:
  - **Universal Interactive CLI**: Sleek terminal setup wizard and lightweight headless daemon designed for Linux SSH servers, mining rigs, and minimal environments.
  - **Modern Desktop GUI**: Electron-based glassmorphic dark-mode dashboard featuring real-time hashrate graphs, hardware gauges, and one-click controls.
- **Hardware Auto-Detection**:
  - **CPU**: Model identification, physical cores, logical threads, and L3 cache size detection with automated thread allocation formulas (e.g. 2 MB L3 cache per RandomX thread).
  - **GPU**: NVIDIA, AMD, and Apple Silicon detection, reporting VRAM (GB), driver versions, and DAG capacity filtering (4GB KawPow/Etchash, 3GB Autolykos2).
- **Dynamic Cloud API Sync**:
  - Real-time algorithm, coin, and verified pool synchronization from [https://api.globalminer.top/api/v1/metadata](https://api.globalminer.top/api/v1/metadata).
  - Built-in multi-tier fallback: disk cache and embedded offline datasets ensure mining never halts even during internet disruptions.
- **Zero-Downtime Emergency Stratum Failover**:
  - Hot-switches upstream stratum connections to a fallback pool instantly if the primary pool experiences downtime or network partitions, preventing idle hardware waste.
  - Seamless background probing automatically reverts hashing to the user's primary pool once restored.
- **1-Minute Developer Fee & GSPC Rebate Engine**:
  - Standard 59-minute user mining / 1-minute dev-fee cycle per hour.
  - Transparently routes telemetry to the active GSPCoin Core network daemon, rewarding miners with instant GSPC rebate credits to their designated address.
- **1-Click Auto-Start Boot Persistence**:
  - **Linux**: Generates, registers, and starts systemd units (`globalminer.service`).
  - **Windows**: Configures Windows Task Scheduler and startup runners with invisible background execution.
  - **macOS**: Deploys launchd LaunchAgents (`~/Library/LaunchAgents/com.globalminer.plist`).

---

## Project Architecture

```
global-miner/
├── core/                    # Core hardware detection, stratum manager, watchdog
│   ├── hardware.js          # Auto-detects CPU (cores, threads, L3 cache) and GPU (NVIDIA/AMD, VRAM)
│   ├── stratumProxy.js      # Local stratum proxy connecting to user pool, dev-fee switcher (1 min/hr), and emergency fallback handler
│   └── apiSync.js           # Client fetching dynamic algorithms, coins, and pools from https://api.globalminer.top/api/v1/
├── cli/                     # Universal CLI mode for headless mining (Linux/Win/Mac)
│   ├── index.js             # Interactive terminal setup wizard (Algo -> Coin -> Pool -> Wallet -> Threads -> GSPC Rebate)
│   └── autoStart.js         # Cross-platform background service installer (systemd, schtasks, launchd)
├── gui/                     # Modern GUI application (Electron / HTML5)
│   ├── main.js              # Electron lifecycle & IPC handlers
│   ├── preload.js           # Secure contextBridge API
│   ├── renderer.js          # Chart rendering, telemetry dials, and event handlers
│   ├── index.html           # Modern sleek UI with dark mode, hardware dials, and failover banners
│   └── package.json
├── linux/                   # Linux run scripts and service helpers
│   ├── run_miner.sh
│   ├── install_service.sh
│   └── uninstall_service.sh
├── windows/                 # Windows batch scripts and Defender helpers
│   ├── run_miner.bat
│   ├── install_service.bat
│   ├── uninstall_service.bat
│   └── add_defender_exclusion.bat
├── mac/                     # macOS shell scripts and launchd helpers
│   ├── run_miner.sh
│   ├── install_service.sh
│   └── uninstall_service.sh
├── package.json             # Root NPM scripts and configuration
└── README.md                # Comprehensive documentation
```

---

## Quick Start Guide

### Prerequisites
- Node.js (version 18.0 or higher). Verify with `node -v`.

---

### Linux (Headless Servers / Rigs)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/gamgsp/global-miner.git
   cd global-miner
   ```

2. **Launch the Interactive Setup Wizard**:
   ```bash
   chmod +x linux/*.sh cli/index.js
   ./linux/run_miner.sh
   # Or directly:
   node cli/index.js
   ```

3. **Install as a Persistent Background Daemon (Systemd)**:
   ```bash
   ./linux/install_service.sh
   ```
   *To check service status*:
   ```bash
   node cli/autoStart.js status
   # Or via systemctl:
   systemctl --user status globalminer.service
   ```

---

### Windows (Gaming PCs & Rig Desktops)

1. **Clone or Download**:
   Extract `global-miner` to `C:\Work\global-miner` or your preferred location.

2. **Add Windows Defender Whitelist Exclusion** (Optional but Recommended):
   *Antivirus software can often falsely flag crypto stratum connections.*
   Right-click `windows\add_defender_exclusion.bat` and select **Run as Administrator**.

3. **Run the Miner**:
   Double-click `windows\run_miner.bat` or run:
   ```cmd
   node cli\index.js
   ```

4. **Install Auto-Start on Windows Boot**:
   Double-click `windows\install_service.bat`. This schedules the task in Windows Task Scheduler and sets up background execution without terminal windows popping up.

---

### macOS (Apple Silicon M-Series & Intel)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/gamgsp/global-miner.git
   cd global-miner
   ```

2. **Run Interactive CLI**:
   ```bash
   chmod +x mac/*.sh
   ./mac/run_miner.sh
   ```

3. **Install LaunchAgent Daemon**:
   ```bash
   ./mac/install_service.sh
   ```

---

### Modern Desktop GUI Mode

To run the sleek desktop dashboard with live hashrate graphs and hardware dials:

```bash
# Navigate to the GUI folder and start
cd gui
npm install electron --save-dev  # If not installed globally
npm start
```
*Or from the root directory*:
```bash
npm run gui
```

---

## CLI Options & Automation

| Command / Flag | Purpose |
|---|---|
| `node cli/index.js` | Launches interactive configuration wizard if no `config.json` exists, otherwise starts mining |
| `node cli/index.js --daemon` | Runs headlessly in background using saved `config.json` |
| `node cli/index.js --config <path>` | Loads configuration from custom JSON file |
| `node cli/index.js --test` | Runs automated non-interactive self-test (hardware scan, API sync, proxy init) |
| `node cli/index.js --install-service` | Installs and enables boot auto-start service for the current OS |
| `node cli/index.js --uninstall-service` | Uninstalls background service |
| `node cli/index.js --status` | Outputs hardware, service, and proxy operational status |
| `node cli/index.js --help` | Displays CLI options manual |

---

## Configuration Reference (`config.json`)

The client generates and persists its configuration in `config.json`:

```json
{
  "algorithm": "randomx",
  "algoName": "RandomX",
  "coin": "XMR",
  "coinName": "Monero",
  "userHost": "pool.supportxmr.com",
  "userPort": 3333,
  "fallbackHost": "xmr.2miners.com",
  "fallbackPort": 2222,
  "walletAddress": "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXMV33WDsen3R7C1wK58MmExncBhDZSTorYnDwScCrGQJD5TeU2W",
  "workerName": "rig1",
  "threads": 8,
  "gspcAddress": "GaMDevMiningRebateWalletAddress123",
  "localProxyPort": 19999,
  "createdAt": "2026-11-16T06:45:00.000Z"
}
```

---

## Supported Algorithms & Coins

| Algorithm | Target Hardware | Min Hardware | Popular Coins |
|---|---|---|---|
| **RandomX** | CPU | 2 MB L3 Cache / thread | Monero (XMR) |
| **KawPow** | GPU | 4.0 GB VRAM | Ravencoin (RVN) |
| **Etchash** | GPU | 4.0 GB VRAM | Ethereum Classic (ETC) |
| **Autolykos2** | GPU | 3.0 GB VRAM | Ergo (ERG) |
| **GhostRider** | CPU | Multi-level cache | Raptoreum (RTM) |
| **Blake3** | CPU / GPU | Any | Alephium (ALPH), Kaspa |

---

## Emergency Stratum Failover Architecture

```
[ Downstream Miner ] (XMRig / T-Rex / lolMiner / Internal)
       │
       ▼ (127.0.0.1:19999)
[ StratumProxy Engine ]
       │
       ├──► Primary Pool (e.g. pool.supportxmr.com:3333) [ACTIVE: 59 min/hr]
       │         ▲
       │         └── Disconnected? ──► [Zero-Downtime Hot Switch]
       │                                       │
       │                                       ▼
       ├──► Emergency Fallback Pool (e.g. xmr.2miners.com:2222)
       │         │
       │         └── Background Probe detects Primary Pool Online ──► [Auto-Revert]
       │
       └──► Dev-Fee Pool (1 min/hr) ──► Heartbeat to Master API ──► GSPC Coin Rebate Credited
```

---

## GSPC Mining Rebate Program

During the 1-minute/hour developer fee cycle:
1. The client securely attaches your configured **GSPC wallet address** to the heartbeat packet.
2. The Global Miner Master Backend verifies hashing shares against the live stratum pool.
3. Automated rebate credits are indexed into the master PostgreSQL ledger.
4. Payouts are distributed via GSPCoin Core InstantSend transactions with zero waiting delays.

Miners can check their live accumulated rebates directly in the GUI or via terminal:
```bash
curl -s https://api.globalminer.top/api/v1/rebates/<YOUR_GSPC_ADDRESS>
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
Developed and maintained by **Global Ads Media, LLC**.
