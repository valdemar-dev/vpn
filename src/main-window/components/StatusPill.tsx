import type { ConnectionState } from "../../../shared/types";

const STATUS_META: Record<ConnectionState, { dot: string; label: string; text: string }> = {
  connected: { dot: "bg-teal animate-live-blink", label: "connected", text: "text-teal" },
  connecting: { dot: "bg-gold animate-live-blink-fast", label: "connecting…", text: "text-gold" },
  disconnected: { dot: "bg-mute", label: "disconnected", text: "text-ink-dim" },
};

export default function StatusPill({ state, sub }: { state: ConnectionState; sub: string }) {
  const meta = STATUS_META[state];

  return (
    <section className="flex shrink-0 items-center gap-2.5 border border-line bg-panel px-3.5 py-2.5 text-[11px] shadow-panel">
      <span className="text-[10px] uppercase tracking-[0.24em] text-mute">status</span>
      <span className={`h-1.5 w-1.5 ${meta.dot}`} />
      <span className={`font-medium tracking-[0.06em] ${meta.text}`}>{meta.label}</span>
      {sub && (
        <span className="ml-auto whitespace-nowrap font-mono text-[10.5px] text-mute">{sub}</span>
      )}
    </section>
  );
}
