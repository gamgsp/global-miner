/**
 * Global Miner - Hardware Detection Engine
 * Auto-detects CPU (cores, threads, L3 cache) and GPU (NVIDIA, AMD, Apple Silicon, VRAM)
 * Supports Linux, Windows, and macOS.
 */

const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

function safeExec(cmd, timeoutMs = 2500) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Detect CPU Details
 */
function detectCpu() {
  const cpus = os.cpus() || [];
  const threads = cpus.length || 1;
  const model = cpus[0]?.model ? cpus[0].model.trim() : 'Generic CPU';
  const speed = cpus[0]?.speed || 0;
  const platform = os.platform();

  let physicalCores = Math.max(1, Math.floor(threads / 2));
  let l3CacheKb = 0;

  if (platform === 'linux') {
    // 1. Try reading L3 cache from sysfs
    try {
      if (fs.existsSync('/sys/devices/system/cpu/cpu0/cache/index3/size')) {
        const rawSize = fs.readFileSync('/sys/devices/system/cpu/cpu0/cache/index3/size', 'utf8').trim();
        if (rawSize.endsWith('K')) l3CacheKb = parseInt(rawSize, 10);
        else if (rawSize.endsWith('M')) l3CacheKb = parseInt(rawSize, 10) * 1024;
      }
    } catch {
      // fallback
    }

    // 2. Try lscpu for physical cores and cache if sysfs was empty
    const lscpu = safeExec('lscpu');
    if (lscpu) {
      const coresMatch = lscpu.match(/Core\(s\)\s+per\s+socket:\s+(\d+)/i);
      const socketsMatch = lscpu.match(/Socket\(s\):\s+(\d+)/i);
      if (coresMatch) {
        const coresPerSocket = parseInt(coresMatch[1], 10);
        const sockets = socketsMatch ? parseInt(socketsMatch[1], 10) : 1;
        physicalCores = coresPerSocket * sockets;
      }

      if (l3CacheKb === 0) {
        const l3Match = lscpu.match(/L3\s+cache:\s+([\d.]+)\s*([KMG]i?B)/i);
        if (l3Match) {
          const val = parseFloat(l3Match[1]);
          const unit = l3Match[2].toUpperCase();
          if (unit.startsWith('K')) l3CacheKb = Math.round(val);
          else if (unit.startsWith('M')) l3CacheKb = Math.round(val * 1024);
          else if (unit.startsWith('G')) l3CacheKb = Math.round(val * 1024 * 1024);
        }
      }
    }
  } else if (platform === 'win32') {
    // Windows WMIC / PowerShell query
    const wmicOutput = safeExec('wmic cpu get NumberOfCores,L3CacheSize /value');
    if (wmicOutput) {
      const coresMatch = wmicOutput.match(/NumberOfCores=(\d+)/i);
      const l3Match = wmicOutput.match(/L3CacheSize=(\d+)/i);
      if (coresMatch) physicalCores = parseInt(coresMatch[1], 10);
      if (l3Match) l3CacheKb = parseInt(l3Match[1], 10); // WMIC reports in KB
    } else {
      const psOutput = safeExec('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).NumberOfCores"');
      if (psOutput) physicalCores = parseInt(psOutput, 10) || physicalCores;
    }
  } else if (platform === 'darwin') {
    // macOS sysctl query
    const phys = safeExec('sysctl -n hw.physicalcpu');
    if (phys) physicalCores = parseInt(phys, 10) || physicalCores;

    const l3 = safeExec('sysctl -n hw.l3cachesize');
    if (l3) {
      const bytes = parseInt(l3, 10);
      if (!isNaN(bytes) && bytes > 0) l3CacheKb = Math.round(bytes / 1024);
    }
  }

  // Calculate L3 Cache in MB
  const l3CacheMb = l3CacheKb > 0 ? parseFloat((l3CacheKb / 1024).toFixed(1)) : 0;

  // RandomX optimal threads formula: 2MB L3 cache per thread, capped at physical threads - 1
  let optimalRandomXThreads = Math.max(1, threads - 1);
  if (l3CacheMb > 0) {
    const cacheBasedThreads = Math.floor(l3CacheMb / 2);
    optimalRandomXThreads = Math.max(1, Math.min(threads, cacheBasedThreads));
  }

  return {
    model,
    speedMhz: speed,
    logicalThreads: threads,
    physicalCores,
    l3CacheMb,
    optimalRandomXThreads,
  };
}

/**
 * Detect GPU Details (NVIDIA, AMD, Apple Silicon)
 */
function detectGpu() {
  const gpus = [];
  const platform = os.platform();

  // 1. Check NVIDIA GPU via nvidia-smi
  const nvsmi = safeExec('nvidia-smi --query-gpu=index,name,memory.total,memory.free,driver_version,temperature.gpu --format=csv,noheader,nounits');
  if (nvsmi) {
    const lines = nvsmi.split('\n');
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        const totalMb = parseInt(parts[2], 10) || 0;
        const freeMb = parseInt(parts[3], 10) || 0;
        gpus.push({
          vendor: 'NVIDIA',
          index: parseInt(parts[0], 10) || 0,
          model: parts[1] || 'NVIDIA GeForce',
          vramMb: totalMb,
          vramGb: parseFloat((totalMb / 1024).toFixed(1)),
          freeVramMb: freeMb,
          driverVersion: parts[4] || 'Unknown',
          tempC: parts[5] ? parseInt(parts[5], 10) : null,
          supportedAlgos: getSupportedGpuAlgos(totalMb / 1024),
        });
      }
    }
  }

  // 2. Check AMD GPU via rocm-smi on Linux or wmic on Windows
  if (gpus.length === 0 && platform === 'linux') {
    const lspci = safeExec('lspci');
    if (lspci && /vga|3d|display/i.test(lspci)) {
      const lines = lspci.split('\n').filter(l => /vga|3d|display/i.test(l));
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        let vendor = 'Generic';
        if (/amd|radeon|ati/i.test(l)) vendor = 'AMD';
        else if (/intel/i.test(l)) vendor = 'Intel';
        else if (/nvidia/i.test(l)) vendor = 'NVIDIA';

        const match = l.match(/:\s+(.+)$/);
        const model = match ? match[1] : l;

        // Try extracting memory from rocm-smi if AMD
        let vramGb = 4.0; // fallback standard estimation
        if (vendor === 'AMD') {
          const rocm = safeExec('rocm-smi --showmeminfo vram --json');
          if (rocm) {
            try {
              const parsed = JSON.parse(rocm);
              const cardKey = Object.keys(parsed)[0];
              if (cardKey && parsed[cardKey]['VRAM Total Memory (B)']) {
                vramGb = parseFloat((parsed[cardKey]['VRAM Total Memory (B)'] / (1024 * 1024 * 1024)).toFixed(1));
              }
            } catch {
              // ignore
            }
          }
        }

        gpus.push({
          vendor,
          index: i,
          model,
          vramMb: Math.round(vramGb * 1024),
          vramGb,
          driverVersion: 'Kernel Driver',
          tempC: null,
          supportedAlgos: getSupportedGpuAlgos(vramGb),
        });
      }
    }
  } else if (gpus.length === 0 && platform === 'win32') {
    const wmicGpu = safeExec('wmic path win32_VideoController get Name,AdapterRAM /value');
    if (wmicGpu) {
      const names = [...wmicGpu.matchAll(/Name=([^\r\n]+)/g)].map(m => m[1].trim());
      const rams = [...wmicGpu.matchAll(/AdapterRAM=(\d+)/g)].map(m => parseInt(m[1], 10));
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        // Skip basic display drivers
        if (/microsoft basic|remote desktop/i.test(name)) continue;

        const bytes = rams[i] || 0;
        const vramGb = bytes > 0 ? parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(1)) : 4.0;
        let vendor = 'Other';
        if (/nvidia/i.test(name)) vendor = 'NVIDIA';
        else if (/amd|radeon/i.test(name)) vendor = 'AMD';
        else if (/intel/i.test(name)) vendor = 'Intel';

        gpus.push({
          vendor,
          index: i,
          model: name,
          vramMb: Math.round(vramGb * 1024),
          vramGb,
          driverVersion: 'DirectX / Windows WDDM',
          tempC: null,
          supportedAlgos: getSupportedGpuAlgos(vramGb),
        });
      }
    }
  } else if (platform === 'darwin') {
    // macOS Apple Silicon or Discrete AMD/Intel
    const profiler = safeExec('system_profiler SPDisplaysDataType');
    if (profiler) {
      const chipsetMatch = profiler.match(/Chipset Model:\s+([^\n]+)/i);
      const vramMatch = profiler.match(/VRAM \(Total\):\s+([^\n]+)/i);
      const model = chipsetMatch ? chipsetMatch[1].trim() : 'Apple Metal Display';
      let vramGb = 8.0; // default Apple Unified Memory assumption

      if (vramMatch) {
        const text = vramMatch[1];
        if (text.includes('GB')) vramGb = parseFloat(text);
        else if (text.includes('MB')) vramGb = parseFloat(text) / 1024;
      }

      gpus.push({
        vendor: model.includes('Apple') ? 'Apple Silicon' : 'AMD/Apple',
        index: 0,
        model,
        vramMb: Math.round(vramGb * 1024),
        vramGb,
        driverVersion: 'Metal 3',
        tempC: null,
        supportedAlgos: getSupportedGpuAlgos(vramGb),
      });
    }
  }

  return gpus;
}

/**
 * Filter algorithms that are mineable with the detected VRAM
 */
function getSupportedGpuAlgos(vramGb) {
  const algos = [];
  if (vramGb >= 3.0) algos.push({ id: 'autolykos2', name: 'Autolykos2 (Ergo)', minVram: 3.0 });
  if (vramGb >= 4.0) {
    algos.push({ id: 'kawpow', name: 'KawPow (Ravencoin)', minVram: 4.0 });
    algos.push({ id: 'etchash', name: 'Etchash (Ethereum Classic)', minVram: 4.0 });
  }
  if (vramGb >= 6.0) {
    algos.push({ id: 'ironfish', name: 'Blake3 / Ironfish', minVram: 4.0 });
  }
  return algos;
}

/**
 * Full Hardware Profile
 */
async function detectHardware() {
  const cpu = detectCpu();
  const gpus = detectGpu();

  const totalRamBytes = os.totalmem();
  const freeRamBytes = os.freemem();
  const totalRamGb = parseFloat((totalRamBytes / (1024 * 1024 * 1024)).toFixed(1));
  const freeRamGb = parseFloat((freeRamBytes / (1024 * 1024 * 1024)).toFixed(1));

  // Determine top hardware recommendations
  const recommendations = [];
  if (cpu.optimalRandomXThreads > 0) {
    recommendations.push({
      target: 'cpu',
      algo: 'randomx',
      coin: 'XMR',
      threads: cpu.optimalRandomXThreads,
      reason: `Optimal for ${cpu.model} with ${cpu.l3CacheMb}MB L3 Cache (${cpu.optimalRandomXThreads} threads = 2MB per thread)`,
    });
    recommendations.push({
      target: 'cpu',
      algo: 'ghostrider',
      coin: 'RTM',
      threads: Math.max(1, cpu.logicalThreads - 2),
      reason: `Great CPU algorithm utilizing all cache levels`,
    });
  }

  if (gpus.length > 0) {
    const primaryGpu = gpus[0];
    if (primaryGpu.vramGb >= 4.0) {
      recommendations.push({
        target: 'gpu',
        algo: 'kawpow',
        coin: 'RVN',
        gpuName: primaryGpu.model,
        vramGb: primaryGpu.vramGb,
        reason: `${primaryGpu.model} (${primaryGpu.vramGb}GB VRAM) meets 4GB DAG for KawPow`,
      });
      recommendations.push({
        target: 'gpu',
        algo: 'etchash',
        coin: 'ETC',
        gpuName: primaryGpu.model,
        vramGb: primaryGpu.vramGb,
        reason: `${primaryGpu.model} meets 4GB DAG for Ethereum Classic`,
      });
    } else if (primaryGpu.vramGb >= 3.0) {
      recommendations.push({
        target: 'gpu',
        algo: 'autolykos2',
        coin: 'ERG',
        gpuName: primaryGpu.model,
        vramGb: primaryGpu.vramGb,
        reason: `${primaryGpu.model} (${primaryGpu.vramGb}GB VRAM) fits Autolykos2 Ergo dataset`,
      });
    }
  }

  return {
    system: {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      ram: {
        totalGb: totalRamGb,
        freeGb: freeRamGb,
        usedPercent: Math.round(((totalRamGb - freeRamGb) / totalRamGb) * 100),
      },
    },
    cpu,
    gpus,
    recommendations,
  };
}

module.exports = {
  detectCpu,
  detectGpu,
  detectHardware,
  getSupportedGpuAlgos,
};
