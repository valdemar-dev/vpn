import { contextBridge, ipcRenderer } from "electron";
import type { AuthApi } from "../shared/types";

const authAPI: AuthApi = {
  submit: (pw: string) => ipcRenderer.send("auth:submit", pw),
  cancel: () => ipcRenderer.send("auth:cancel"),
};

contextBridge.exposeInMainWorld("authAPI", authAPI);
