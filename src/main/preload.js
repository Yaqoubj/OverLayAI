const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quickAI", {
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  showOverlay: () => ipcRenderer.invoke("overlay:show"),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  resetOverlayPosition: () => ipcRenderer.invoke("overlay:reset-position"),
  pinOverlay: (pinned) => ipcRenderer.invoke("overlay:pin", pinned),
  endAllOperations: () => ipcRenderer.invoke("app:end-all"),
  resetSession: () => ipcRenderer.invoke("site:reset-session"),
  reloadSite: () => ipcRenderer.invoke("site:reload"),
  onConfig: (callback) => ipcRenderer.on("config", (_event, payload) => callback(payload)),
  onSiteStatus: (callback) => ipcRenderer.on("site-status", (_event, payload) => callback(payload))
});
