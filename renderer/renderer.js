const $ = (id) => document.getElementById(id);

const statusDot = $("statusDot");
const statusText = $("statusText");
const statusSub = $("statusSub");
const flag = $("flag");
const serverCountry = $("serverCountry");
const serverHost = $("serverHost");
const serverIp = $("serverIp");
const nextBtn = $("nextBtn");
const connectBtn = $("connectBtn");
const discBtn = $("discBtn");
const logList = $("logList");
const vpnSelector = $("vpnSelector");
const vpnToggleBtn = $("vpnToggleBtn");
const vpnsDropdown = $("vpnsDropdown");

function setStatus(state, sub = "") {
  const map = {
    connected: ["live-on", "connected", "st-connected"],
    connecting: ["live-busy", "connecting…", "st-connecting"],
    disconnected: ["live", "disconnected", "st-disconnected"],
  };

  const [dot, text, textCls] = map[state];
  
  statusDot.className = `live ${dot}`.trim();
  statusText.textContent = text;
  statusText.className = `status-text ${textCls}`;
  statusSub.textContent = sub;
}

function showServer(server) {
  flag.textContent = server.country_short || "--";
  serverCountry.textContent = server.country_long || server.country_short || "connected";
  serverHost.textContent = server.hostname || "";
  serverIp.textContent = server.ip ? `ip: ${server.ip}` : "";
}

function resetServer() {
  flag.textContent = "--";
  serverCountry.textContent = "no connection";
  serverHost.textContent = "";
  serverIp.textContent = "";
}

function showVpnsList(vpns) {
  vpnsDropdown.innerHTML = "";
  
  if (!vpns || vpns.length === 0) {
    vpnsDropdown.innerHTML = '<div class="empty-state">No unused VPNs available</div>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  for (const v of vpns) {
    const item = document.createElement("div");
    item.className = "vpn-item";
    item.dataset.ip = v.ip;
    item.dataset.countryShort = v.country_short;
    item.dataset.countryLong = v.country_long;
    item.dataset.hostname = v.hostname || "";
    item.innerHTML = `<span class="vpn-country">${v.country_long || v.country_short}</span><span class="vpn-ip">ip: ${v.ip}</span>`;
    fragment.appendChild(item);
  }
  
  vpnsDropdown.appendChild(fragment);
  vpnsDropdown.scrollTop = 0;
}

let connected = false;

function setBusy(busy) {
  nextBtn.disabled = busy;
  discBtn.disabled = busy;
  connectBtn.disabled = busy;
  nextBtn.textContent = busy ? "working..." : "connect next >";
  vpnToggleBtn.disabled = busy;
}

function setConnected(isConnected) {
  connected = isConnected;
}

function addLog(line) {
  const div = document.createElement("div");
  let cls = "";
  
  if (line.includes("ERROR")) cls = "log-err";
  else if (line.includes("WARNING")) cls = "log-warn";
  else if (line.includes("successfully") || line.includes("Blocked IPv6")) cls = "log-ok";
  
  if (cls) div.className = cls;
  
  div.textContent = line;
  logList.appendChild(div);
  
  while (logList.children.length > 120) logList.removeChild(logList.firstChild);
  
  logList.scrollTop = logList.scrollHeight;
}

async function refreshStatus() {
  const st = await window.vpnAPI.status();
  
  if (st.connected) {
    setStatus("connected", `pid ${st.pid}`);
    showServer(st);
    setConnected(true);
    vpnSelector.classList.remove("open");
    if (vpnSelector) vpnSelector.style.display = "none";
  } else {
    setStatus("disconnected");
    resetServer();
    setConnected(false);
    const unused = await window.vpnAPI.getUnusedVpns();
    showVpnsList(unused);
    if (vpnSelector) vpnSelector.style.display = "block";
  }
}

window.vpnAPI.onEvent((ev) => {
  switch (ev.type) {
    case "log":
      addLog(ev.message);
      break;
    case "busy":
      setBusy(ev.busy);
      break;
    case "status":
      if (ev.state === "connecting") setStatus("connecting", ev.message);
      break;
    case "connected":
      setStatus("connected", `pid ${ev.pid}`);
      showServer(ev);
      setConnected(true);
      vpnSelector.classList.remove("open");
      if (vpnSelector) vpnSelector.style.display = "none";
      break;
    case "disconnected":
      setStatus("disconnected");
      resetServer();
      setConnected(false);
      if (vpnSelector) vpnSelector.style.display = "block";
      refreshStatus();
      break;
  }
});

nextBtn.addEventListener("click", () => window.vpnAPI.next());
connectBtn.addEventListener("click", () => window.vpnAPI.connect());
discBtn.addEventListener("click", () => window.vpnAPI.disconnect());
$("hideBtn").addEventListener("click", () => window.vpnAPI.hide());

vpnsDropdown.addEventListener("click", (e) => {
  const item = e.target.closest(".vpn-item");
  if (!item) return;
  
  const vpn = {
    ip: item.dataset.ip,
    country_short: item.dataset.countryShort,
    country_long: item.dataset.countryLong,
    hostname: item.dataset.hostname,
  };
  vpnSelector.classList.remove("open");
  connectToVpn(vpn);
});

vpnToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  vpnSelector.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!vpnSelector.contains(e.target)) vpnSelector.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") vpnSelector.classList.remove("open");
});

function connectToVpn(vpn) {
  window.vpnAPI.connectVpn(vpn.ip, vpn.country_short);
}

refreshStatus();