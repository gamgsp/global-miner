/**
 * Global Miner - Electron Preload Script
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getHardware: () => ipcRenderer.invoke('get-hardware'),
  getMetadata: () => ipcRenderer.invoke('get-metadata'),
  getRebates: (addr) => ipcRenderer.invoke('get-rebates', addr),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  startMining: (cfg) => ipcRenderer.invoke('start-mining', cfg),
  stopMining: () => ipcRenderer.invoke('stop-mining'),
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  installService: () => ipcRenderer.invoke('install-service'),
  uninstallService: () => ipcRenderer.invoke('uninstall-service'),
  onMiningEvent: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('mining-event', subscription);
    return () => ipcRenderer.removeListener('mining-event', subscription);
  },
});
