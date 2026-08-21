import { useEffect, useRef } from "react";
import type { VpnServer } from "../../../shared/types";
import { btnDefault } from "../../lib/ui";

interface Props {
  vpns: VpnServer[];
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (vpn: VpnServer) => void;
}

export default function ServerSelector({ vpns, busy, open, onToggle, onClose, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [vpns]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`${btnDefault} flex w-full items-center justify-between ${open ? "border-gold text-ink" : ""}`}
      >
        view servers
        <span
          className={`text-[10px] transition-all duration-150 ${
            open ? "rotate-180 text-gold" : "text-mute"
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute inset-x-0 bottom-[calc(100%+8px)] z-10 max-h-[200px] overflow-y-auto border border-line bg-panel shadow-panel"
        >
          {vpns.length === 0 ? (
            <div className="p-3 text-center text-xs text-mute">No unused VPNs available</div>
          ) : (
            vpns.map((v) => (
              <button
                key={v.ip}
                type="button"
                onClick={() => onSelect(v)}
                className="flex w-full cursor-pointer items-baseline justify-between gap-2.5 border-b border-line-soft px-3 py-2.5 text-xs transition-colors duration-150 last:border-b-0 hover:bg-gold-soft"
              >
                <span className="text-ink">{v.country_long || v.country_short}</span>
                <span className="whitespace-nowrap font-mono text-[10.5px] text-mute">
                  ip: {v.ip}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
