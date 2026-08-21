import { useCallback, useEffect, useState } from "react";
import type { ConnectionState, ServerInfo, VpnEvent, VpnServer } from "../../shared/types";
import Titlebar from "./components/Titlebar";
import StatusPill from "./components/StatusPill";
import ServerCard from "./components/ServerCard";
import ServerSelector from "./components/ServerSelector";
import LogView from "./components/LogView";
import { btnDefault, btnDanger, btnPrimary } from "../lib/ui";

interface StatusState {
  state: ConnectionState;
  sub: string;
}

const MAX_LOG_LINES = 120;

export default function App() {
  const [status, setStatus] = useState<StatusState>({ state: "disconnected", sub: "" });
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [unused, setUnused] = useState<VpnServer[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const refreshStatus = useCallback(async () => {
    const st = await window.vpnAPI.status();

    if (st.connected) {
      setStatus({ state: "connected", sub: `pid ${st.pid}` });
      setServer(st);
      setSelectorOpen(false);
    } else {
      setStatus({ state: "disconnected", sub: "" });
      setServer(null);
      setUnused(await window.vpnAPI.getUnusedVpns());
    }
  }, []);

  useEffect(() => {
    const applyEvent = (ev: VpnEvent) => {
      switch (ev.type) {
        case "log":
          setLogs((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), ev.message]);
          break;
        case "busy":
          setBusy(ev.busy);
          break;
        case "status":
          if (ev.state === "connecting") setStatus({ state: "connecting", sub: ev.message ?? "" });
          break;
        case "connected":
          setStatus({ state: "connected", sub: `pid ${ev.pid}` });
          setServer(ev);
          setSelectorOpen(false);
          break;
        case "disconnected":
          setStatus({ state: "disconnected", sub: "" });
          setServer(null);
          void refreshStatus();
          break;
      }
    };

    return window.vpnAPI.onEvent(applyEvent);
  }, [refreshStatus]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connected = status.state === "connected";

  return (
    <div className="flex h-screen flex-col gap-3.5 px-[18px] pb-[18px]">
      <Titlebar onHide={() => window.vpnAPI.hide()} />

      <StatusPill state={status.state} sub={status.sub} />

      <ServerCard server={server} />

      <div className="flex shrink-0 flex-col gap-2">
        {!connected && (
          <ServerSelector
            vpns={unused}
            busy={busy}
            open={selectorOpen}
            onToggle={() => setSelectorOpen((o) => !o)}
            onClose={() => setSelectorOpen(false)}
            onSelect={(vpn) => {
              setSelectorOpen(false);
              void window.vpnAPI.connectVpn(vpn.ip, vpn.country_short ?? undefined);
            }}
          />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void window.vpnAPI.next()}
          className={btnPrimary}
        >
          {busy ? "working..." : "connect next >"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void window.vpnAPI.connect()}
          className={btnDefault}
        >
          connect
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void window.vpnAPI.disconnect()}
          className={btnDanger}
        >
          disconnect
        </button>
      </div>

      <LogView lines={logs} />

      <footer className="shrink-0 text-center text-[9px] uppercase tracking-[0.24em] text-mute">
        closes to tray
      </footer>
    </div>
  );
}
