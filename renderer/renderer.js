const $ = (id) => document.getElementById(id);

const statusDot = $("statusDot");
const statusText = $("statusText");
const statusSub = $("statusSub");
const flag = $("flag");
const serverCountry = $("serverCountry");
const serverHost = $("serverHost");
const serverIp = $("serverIp");
const nextBtn = $("nextBtn");
const discBtn = $("discBtn");
const logList = $("logList");

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

function setBusy(busy) {
  nextBtn.disabled = busy;
  discBtn.disabled = busy;
  nextBtn.textContent = busy ? "working..." : "connect next >";
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
  } else {
    setStatus("disconnected");
    resetServer();
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
      break;
    case "disconnected":
      setStatus("disconnected");
      resetServer();
      break;
  }
});

nextBtn.addEventListener("click", () => window.vpnAPI.next());
discBtn.addEventListener("click", () => window.vpnAPI.disconnect());
$("hideBtn").addEventListener("click", () => window.vpnAPI.hide());

refreshStatus();