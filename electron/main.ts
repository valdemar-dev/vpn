import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { VpnManager } from "./vpn";
import type { VpnStatus } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const vpn = new VpnManager();
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function sendEvent(type: string, payload: Record<string, unknown> = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("vpn:event", { type, ...payload });
  }
}

const devUrl = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "VPN Manager",
    icon: path.join(__dirname, "..", "assets", "icon.png"),

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function trayIcon(connected: boolean) {
  const file = connected ? "tray-connected.png" : "tray-disconnected.png";

  return nativeImage.createFromPath(path.join(__dirname, "..", "assets", file));
}

function updateTray(status: VpnStatus) {
  if (!tray) return;

  tray.setImage(trayIcon(status.connected));
  tray.setToolTip(
    status.connected
      ? `VPN connected - ${status.country_short} ${status.ip}`
      : "VPN disconnected"
  );
}

function createTray() {
  tray = new Tray(trayIcon(false));
  tray.setToolTip("VPN Manager");

  const menu = Menu.buildFromTemplate([
    {
      label: "Connect Next",
      click: () => runAction("next"),
    },
    {
      label: "Reconnect",
      click: () => runAction("connect"),
    },
    {
      label: "Disconnect",
      click: () => runAction("disconnect"),
    },
    { type: "separator" },
    {
      label: "Fetch Server List",
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send("vpn:fetch-list");
        }
      },
    },
    { type: "separator" },
    {
      label: "Show",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

let busy = false;

async function createPasswordDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 360,
      height: 300,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: "Authorize",
      parent: mainWindow || undefined,
      modal: Boolean(mainWindow),
      icon: path.join(__dirname, "..", "assets", "icon.png"),

      webPreferences: {
        preload: path.join(__dirname, "password-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    let done = false;

    const finish = (pw: string | null) => {
      if (done) return;

      done = true;

      resolve(pw);

      if (!win.isDestroyed()) {
        win.close();
      }
    };

    ipcMain.once("auth:submit", (_e, pw: string) => finish(pw));
    ipcMain.once("auth:cancel", () => finish(null));

    win.on("closed", () => finish(null));

    if (devUrl) {
      win.loadURL(`${devUrl}/password.html`);
    } else {
      win.loadFile(path.join(__dirname, "..", "dist", "renderer", "password.html"));
    }
  });
}

interface ConnectParams {
  ip?: string;
  country?: string;
  country_short?: string;
}

async function runAction(action: string, params: ConnectParams = {}) {
  if (busy) return;

  busy = true;

  sendEvent("busy", { busy: true });

  try {
    if (action === "next" || action === "connect" || action === "connect-vpn") {
      const ok = await vpn.ensureRoot();

      if (!ok) {
        vpn.log("ERROR: Cannot connect without elevated access.");
        sendEvent("disconnected", {});

        return;
      }

      if (action === "next") {
        sendEvent("status", { state: "connecting", message: "Connecting to next server..." });

        const st = await vpn.connectNext();

        if (st) sendEvent("connected", { ...st });
        else sendEvent("disconnected", {});
      } else if (action === "connect-vpn") {
        sendEvent("status", { state: "connecting", message: `Connecting to ${params.country_short || params.country} ${params.ip}...` });

        const st = await vpn.connectTo(params.ip!, params.country!);

        if (st) sendEvent("connected", { ...st });
        else sendEvent("disconnected", {});
      } else {
        sendEvent("status", { state: "connecting", message: "Reconnecting to last server..." });

        const st = await vpn.connectLast();

        if (st) sendEvent("connected", { ...st });
        else sendEvent("disconnected", {});
      }
    } else if (action === "disconnect") {

      await vpn.disconnectVpn();
      sendEvent("disconnected", {});
    }
  } catch (e) {

    vpn.log(`ERROR: ${(e as Error).message}`);
    sendEvent("disconnected", {});
  } finally {
    busy = false;

    sendEvent("busy", { busy: false });
    updateTray(vpn.status());
  }
}

ipcMain.handle("vpn:next", () => runAction("next"));
ipcMain.handle("vpn:connect", () => runAction("connect"));
ipcMain.handle("vpn:disconnect", () => runAction("disconnect"));
ipcMain.handle("vpn:status", () => vpn.status());
ipcMain.handle("vpn:fetch-list", async () => {
  const vpns = await vpn.fetchVpns(true);
  return vpns;
});
ipcMain.handle("vpn:connect-vpn", (_e, { ip, country }: ConnectParams) => runAction("connect-vpn", { ip, country }));
ipcMain.handle("vpn:get-unused-vpns", async () => {
  return vpn.getUnusedVpns();
});
ipcMain.on("window:hide", () => mainWindow && mainWindow.hide());

vpn.on("log", (line) => sendEvent("log", { message: line }));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  vpn.askPassword = createPasswordDialog;
  vpn.log("VPN Manager started.");

  createWindow();
  createTray();

  updateTray(vpn.status());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});
