import { contextBridge, ipcRenderer } from "electron";
import type { VpnEvent, VpnApi, Unsubscribe } from "../shared/types";

const vpnAPI: VpnApi = {
  next: () => ipcRenderer.invoke("vpn:next"),
  connect: () => ipcRenderer.invoke("vpn:connect"),
  disconnect: () => ipcRenderer.invoke("vpn:disconnect"),
  status: () => ipcRenderer.invoke("vpn:status"),
  fetchList: () => ipcRenderer.invoke("vpn:fetch-list"),
  connectVpn: (ip, country) => ipcRenderer.invoke("vpn:connect-vpn", { ip, country }),
  getUnusedVpns: () => ipcRenderer.invoke("vpn:get-unused-vpns"),
  hide: () => ipcRenderer.send("window:hide"),
  onEvent: (cb: (ev: VpnEvent) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, payload: VpnEvent) => cb(payload);
    ipcRenderer.on("vpn:event", listener);
    return () => ipcRenderer.removeListener("vpn:event", listener);
  },
};

contextBridge.exposeInMainWorld("vpnAPI", vpnAPI);
