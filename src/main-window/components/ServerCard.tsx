import type { ServerInfo } from "../../../shared/types";

export default function ServerCard({ server }: { server: ServerInfo | null }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 border border-line bg-panel p-5 shadow-panel">
      <span className="ml-[0.45em] font-mono text-[11px] uppercase tracking-[0.45em] text-gold">
        {server?.country_short || "--"}
      </span>
      <span className="wonk text-center font-display text-[30px] font-medium leading-[1.05] tracking-[0.01em]">
        {server ? server.country_long || server.country_short || "connected" : "no connection"}
      </span>
      <span className="text-center font-mono text-xs text-ink-dim">{server?.hostname || ""}</span>
      <span className="text-center font-mono text-[11px] text-mute">
        {server?.ip ? `ip: ${server.ip}` : ""}
      </span>
    </section>
  );
}
