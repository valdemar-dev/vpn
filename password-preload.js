const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("authAPI", {
  submit: (pw) => ipcRenderer.send("auth:submit", pw),
  cancel: () => ipcRenderer.send("auth:cancel"),
});