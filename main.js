const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require("electron");
const path = require("path");
const { VpnManager } = require("./vpn");

let mainWindow = null;
let tray = null;
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

function sendEvent(type, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("vpn:event", { type, ...payload });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "VPN Manager",
    icon: path.join(__dirname, "assets", "icon.png"),

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function trayIcon(connected) {
  const file = connected ? "tray-connected.png" : "tray-disconnected.png";

  return nativeImage.createFromPath(path.join(__dirname, "assets", file));
}

function updateTray(status) {
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
      label: "Show",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
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

async function createPasswordDialog() {
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
      icon: path.join(__dirname, "assets", "icon.png"),

      webPreferences: {
        preload: path.join(__dirname, "password-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    let done = false;

    const finish = (pw) => {
      if (done) return;

      done = true;

      resolve(pw);

      if (!win.isDestroyed()) {
        win.close();
      }
    };

    ipcMain.once("auth:submit", (_e, pw) => finish(pw));
    ipcMain.once("auth:cancel", () => finish(null));

    win.on("closed", () => finish(null));
    
    win.loadFile(path.join(__dirname, "renderer", "password.html"));
  });
}

async function runAction(action) {
  if (busy) return;
  
  busy = true;
  
  sendEvent("busy", { busy: true });
  
  try {
    if (action === "next" || action === "connect") {
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
  
    vpn.log(`ERROR: ${e.message}`);
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
ipcMain.on("window:hide", () => mainWindow && mainWindow.hide());

vpn.on("log", (line) => sendEvent("log", { message: line }));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  
  vpn.askPassword = createPasswordDialog;
  vpn.log("VPN Manager started.");
  
  createWindow();
  createTray();
  
  updateTray(vpn.status());

  vpn.ensureRoot();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});
