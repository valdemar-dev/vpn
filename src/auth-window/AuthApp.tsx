import { useEffect, useRef, useState } from "react";
import { btnDefault, btnPrimary } from "../lib/ui";

export default function AuthApp() {
  const [pw, setPw] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => window.authAPI.submit(pw);

  return (
    <div className="flex h-screen flex-col gap-3.5 p-[18px]">
      <section className="flex flex-col gap-1.5 border border-line bg-panel p-4 shadow-panel">
        <span className="text-[10px] uppercase tracking-[0.24em] text-mute">elevate</span>
        <span className="wonk font-display text-xl font-medium leading-[1.15]">
          VPN Manager needs root
        </span>
        <span className="text-xs text-ink-dim">one-time prompt to run openvpn &amp; ip6tables</span>
        <input
          ref={inputRef}
          type="password"
          placeholder="sudo password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") window.authAPI.cancel();
          }}
          className="mt-2.5 box-border w-full border border-line bg-base px-[11px] py-[9px] font-mono text-[13px] text-ink outline-none focus:border-gold"
        />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={submit} className={`${btnPrimary} flex-1`}>
            authorize
          </button>
          <button type="button" onClick={() => window.authAPI.cancel()} className={`${btnDefault} flex-1`}>
            cancel
          </button>
        </div>
      </section>
    </div>
  );
}
