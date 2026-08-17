const { EventEmitter } = require("events");
const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { app } = require("electron");

const VPNGATE_API = "http://www.vpngate.net/api/iphone/";
const CACHE_TTL_MS = 3600 * 1000;
const HISTORY_TTL_MS = 24 * 3600 * 1000;

function resolveBaseDir() {
  if (process.env.VPN_DATA_DIR) return process.env.VPN_DATA_DIR;
  if (app.isPackaged) return app.getPath("userData");
  if (process.env.APPIMAGE) return path.join(os.homedir(), ".config", "vpn-manager");

  return path.join(__dirname, "..");
}

const BASE_DIR = resolveBaseDir();
const OVPN_DIR = path.join(BASE_DIR, "ovpn_configs");
const LOG_FILE = path.join(BASE_DIR, "vpn-manager.log");
const OPENVPN_LOG = path.join(BASE_DIR, "openvpn.log");
const PID_FILE = path.join(BASE_DIR, "openvpn.pid");
const HISTORY_FILE = path.join(BASE_DIR, "history.json");
const CACHE_FILE = path.join(BASE_DIR, "vpngate_cache.json");
const STATE_FILE = path.join(BASE_DIR, "state.json");

fs.mkdirSync(OVPN_DIR, { recursive: true });

function which(cmd) {
  try {
    return execFileSync("which", [cmd], { stdio: "pipe" }).toString().trim();
  } catch {
    return null;
  }
}

const HAS_SUDO = Boolean(which("sudo"));
const HAS_PKEXEC = Boolean(which("pkexec"));
const OPENVPN_BIN = which("openvpn") || "openvpn";

const ASKPASS_FILE = app.isPackaged
  ? path.join(process.resourcesPath, "bin", "askpass.sh")
  : path.join(__dirname, "scripts", "askpass.sh");

async function trySudoNoPrompt() {
  try {
    await exec("sudo", ["-n", "true"], { timeout: 10000 });

    return true;
  } catch {
    return false;
  }
}

// get authorization (needed for iptables and stuff)
async function ensureAuthorized() {
  if (!HAS_SUDO) return HAS_PKEXEC;

  if (await trySudoNoPrompt()) return true;
  try {
    await exec("sudo", ["-A", "-v"], {
      timeout: 120000,
      env: { ...process.env, SUDO_ASKPASS: ASKPASS_FILE },
    });

    return true;
  } catch {}
  if (!vpnManager || !vpnManager.askPassword) return false;
  
  const password = await vpnManager.askPassword();
  
  if (password == null) return false;
  
  const tmpFile = path.join(os.tmpdir(), `vpn-askpass-${process.pid}`);
  
  try {
    fs.writeFileSync(tmpFile, password, { mode: 0o600 });
  
    await exec("sudo", ["-A", "-v"], {
      timeout: 60000,
      env: { ...process.env, SUDO_ASKPASS: ASKPASS_FILE, VPN_ASKPASS_FILE: tmpFile },
    });
  
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

function exec(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, timeout: 120000, ...options }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stdout, stderr }));
  
      else resolve({ stdout, stderr });
    });
  });
}

async function execPrivileged(args, options = {}) {
  if (HAS_SUDO) {
    if (!(await ensureAuthorized())) {
      throw new Error("Elevated access not granted.");
    }

    return exec("sudo", ["-n", ...args], options);
  }
  if (HAS_PKEXEC) {
    const abs = args.map((a) => (a.includes("/") ? a : which(a) || a));

    return exec("pkexec", abs, options);
  }

  throw new Error("Neither sudo nor pkexec is available; cannot run privileged commands.");
}

let vpnManager = null;

class VpnManager extends EventEmitter {
  constructor() {
    super();
    this.state = this.loadState();
    this.askPassword = null;

    vpnManager = this;
  }

  async ensureRoot() {
    const ok = await ensureAuthorized();

    if (ok) this.log("Elevated access granted successfully.");
    else this.log("ERROR: Elevated access denied or unavailable.");

    return ok;
  }

  log(msg) {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    const line = `${ts} - ${msg}`;

    try {
      fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {}

    this.emit("log", line);
  }

  loadState() {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    } catch {
      return { 
        connected: false 
      };
    }
  }

  saveState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch {}
  }

  loadHistory() {
    try {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
      const now = Date.now();
      
      return Object.fromEntries(
        Object.entries(data).filter(([, ts]) => now - Number(ts) * 1000 < HISTORY_TTL_MS)
      
      );
    } catch {
      return {};
    }
  }

  saveHistory(history) {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (e) {
      this.log(`WARNING: Failed to save history file: ${e.message}`);
    }
  }

  recordUsedIp(ip) {
    const history = this.loadHistory();
    
    history[ip] = Date.now() / 1000;
    
    this.saveHistory(history);
  }

  loadCachedVpns() {
    try {
      const stat = fs.statSync(CACHE_FILE);
    
      if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    
      this.log("Loaded VPNGate list from local cache.");
    
      return data;
    } catch {
      return null;
    }
  }

  saveCachedVpns(vpns) {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(vpns, null, 2));
    } catch (e) {
      this.log(`WARNING: Failed to write VPNGate cache: ${e.message}`);
    }
  }

  async fetchVpns(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.loadCachedVpns();
    
      if (cached) return cached;
    }

    this.log("Fetching fresh server list from VPNGate...");
    
    let content;
    
    try {
      const res = await exec(
        "curl",
        ["-sL", "-A", "Mozilla/5.0 (X11; Linux x86_64)", "--max-time", "30", VPNGATE_API],
        { timeout: 35000 }
      );
    
      content = res.stdout;
    } catch (e) {
      this.log(`ERROR: Failed to fetch VPNGate list: ${e.stderr || e.message}`);
    
      return [];
    }

    const results = [];
    
    for (const line of content.split("\n")) {
      if (!line.trim() || line.startsWith("#") || line.startsWith("*")) continue;
    
      const parts = line.split(",");
    
      if (parts.length < 15) continue;
    
      const [hostname, ip, score, , , countryLong, countryShort, , , , , , , , configB64] = parts;
    
      if (!ip || !configB64) continue;
    
      results.push({
        hostname,
        ip,
        score,
        country_short: countryShort,
        country_long: countryLong,
        config_b64: configB64,
      });
    }

    results.sort((a, b) => {
      const ac = a.country_short || "ZZ";
      const bc = b.country_short || "ZZ";
    
      if (ac !== bc) return ac < bc ? -1 : 1;
    
      return (parseInt(a.score, 10) || 0) - (parseInt(b.score, 10) || 0);
    });

    if (results.length) this.saveCachedVpns(results);
    
    return results;
  }

  async applyIpv6Firewall(block) {
    const ip6tables = which("ip6tables") || "ip6tables";
    const action = block ? "-A" : "-D";
    const msg = block ? "Blocked IPv6 leak via ip6tables" : "Unblocked IPv6";
    
    try {
      await execPrivileged(["ip6tables", action, "OUTPUT", "-j", "DROP"]);
      await execPrivileged(["ip6tables", action, "INPUT", "-j", "DROP"]);
      await execPrivileged(["ip6tables", action, "FORWARD", "-j", "DROP"]);
    
      this.log(msg);
    } catch (e) {
    
      this.log(`WARNING: ip6tables operation failed: ${e.stderr || e.message}`);
    }
  }

  isDaemonAlive() {
    try {
      execFileSync("pgrep", ["-F", PID_FILE], { stdio: "ignore" });
    
      return true;
    } catch {
      return false;
    }
  }

  async connectVpn(ip, country) {
    const vpns = await this.fetchVpns();
    const target = vpns.find((v) => v.ip === ip);
    
    if (!target) {
      this.log(`ERROR: Server ${ip} not found in VPNGate list.`);
    
      return false;
    }

    this.log(`Decoding OpenVPN config for ${country} ${ip}...`);
    
    let configText;
    
    try {
      configText = Buffer.from(target.config_b64, "base64").toString("utf8");
    } catch (e) {
      this.log(`ERROR: Failed to decode base64 config for ${ip}: ${e.message}`);
    
      return false;
    }

    const configFile = path.join(OVPN_DIR, `${country}_${ip}.ovpn`);
    fs.writeFileSync(configFile, configText, "utf8");

    this.log(`Starting OpenVPN daemon connection to ${country} ${ip}...`);
    
    try {
      await execPrivileged([
        OPENVPN_BIN,
        "--config",
        configFile,
        "--daemon",
        "--writepid",
        PID_FILE,
        "--log",
        OPENVPN_LOG,
      ]);
    } catch (e) {
      this.log(`ERROR: OpenVPN command failed: ${e.stderr || e.message}`);
    
      return false;
    }

    await new Promise((r) => setTimeout(r, 4000));

    if (fs.existsSync(PID_FILE) && this.isDaemonAlive()) {
      const pid = fs.readFileSync(PID_FILE, "utf8").trim();
    
      this.log(`VPN daemon running successfully! PID: ${pid}`);
      this.state = {
        connected: true,
        ip,
        country_short: target.country_short,
        country_long: target.country_long,
        hostname: target.hostname,
        pid,
        ts: Date.now() / 1000,
        last: {
          ip,
          country_short: target.country_short,
          country_long: target.country_long,
          hostname: target.hostname,
        },
      };
    
      this.saveState();
    
      await this.applyIpv6Firewall(true);
    
      this.recordUsedIp(ip);
    
      return true;
    }

    this.log("ERROR: OpenVPN process exited after launch.");
    
    try {
      const tail = fs.readFileSync(OPENVPN_LOG, "utf8").trim().split("\n").slice(-5).join("\n");
    
      this.log(`OpenVPN Log Tail:\n${tail}`);
    } catch (e) {
      this.log(`WARNING: Could not read openvpn log: ${e.message}`);
    }
    
    return false;
  }

  async disconnectVpn() {
    this.log("Disconnecting VPN...");
    
    const killBin = which("kill") || "kill";
    const killall = which("killall") || "killall";
    
    if (fs.existsSync(PID_FILE)) {
      try {
        const pid = fs.readFileSync(PID_FILE, "utf8").trim();
    
        if (pid) await execPrivileged([killBin, "-15", pid]);
      } catch (e) {
        this.log(`ERROR stopping via PID file: ${e.message}`);
      }
    
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      await execPrivileged([killall, "-15", "openvpn"]);
    } catch {}

    try {
      fs.unlinkSync(PID_FILE);
    } catch {}

    this.state = {
      connected: false,
      ...(this.state.last ? { last: this.state.last } : {}),
    };
    this.saveState();
    
    await this.applyIpv6Firewall(false);
    
    this.log("VPN disconnected successfully.");
  }

  async connectLast() {
    const last = this.state.last;

    if (!last || !last.ip) {
      this.log("ERROR: No previous server to reconnect to.");

      return false;
    }

    this.log(`Reconnecting to last server ${last.country_short} ${last.ip}...`);

    const ok = await this.connectVpn(last.ip, last.country_short);

    return ok ? this.status() : false;
  }

  async connectNext() {
    await this.disconnectVpn();
    
    const history = this.loadHistory();
    const vpns = await this.fetchVpns(true);

    if (!vpns.length) {
      this.log("ERROR: Unable to fetch VPNGate list for 'next'.");
    
      return false;
    }

    for (const vpn of vpns) {
      if (history[vpn.ip]) continue;
    
      this.log(`Found unused IP from past 24 hours: ${vpn.ip} (${vpn.country_short})`);
    
      const ok = await this.connectVpn(vpn.ip, vpn.country_short);
    
      if (ok) return this.status();
    
      this.log(`Connection failed for ${vpn.ip}, searching for alternative...`);
    }

    this.log("ERROR: All available VPNGate IPs have been used within the past 24 hours.");
    
    return false;
  }

  status() {
    if (this.state.connected && this.isDaemonAlive()) {
      return { connected: true, ...this.state };
    }
    
    this.state = {
      connected: false,
      ...(this.state.last ? { last: this.state.last } : {}),
    };
    this.saveState();
    
    return { connected: false };
  }
}

module.exports = { VpnManager };
