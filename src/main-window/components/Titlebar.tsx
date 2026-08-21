export default function Titlebar({ onHide }: { onHide: () => void }) {
  return (
    <header className="flex h-[46px] shrink-0 items-center justify-between gap-3 border-b border-line-soft">
      <div className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.14em] text-mute">
        <span className="grid h-6 w-6 place-items-center border border-gold font-display text-sm text-gold">
          V
        </span>
        <span>VPN Manager</span>
      </div>
      <button
        type="button"
        title="Minimize to tray"
        onClick={onHide}
        className="grid h-6 w-6 cursor-pointer place-items-center border border-transparent bg-transparent text-[13px] leading-none text-mute transition-colors duration-150 hover:border-line hover:bg-white/[0.04] hover:text-ink-dim"
      >
        −
      </button>
    </header>
  );
}
