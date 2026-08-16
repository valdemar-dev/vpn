const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vpnAPI", {
  next: () => ipcRenderer.invoke("vpn:next"),
  connect: () => ipcRenderer.invoke("vpn:connect"),
  disconnect: () => ipcRenderer.invoke("vpn:disconnect"),
  status: () => ipcRenderer.invoke("vpn:status"),
  hide: () => ipcRenderer.send("window:hide"),
  onEvent: (cb) => ipcRenderer.on("vpn:event", (_event, payload) => cb(payload)),
});
