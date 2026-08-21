import { useEffect, useRef } from "react";

function lineClass(line: string): string {
  if (line.includes("ERROR")) return "text-red";
  if (line.includes("WARNING")) return "text-gold";
  if (line.includes("successfully") || line.includes("Blocked IPv6")) return "text-teal";
  return "";
}

export default function LogView({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      className="min-h-20 flex-1 select-text overflow-y-auto border border-line-soft bg-[#0c0c0a] px-3.5 py-3 font-mono text-[10.5px] leading-[1.75] text-ink-dim"
    >
      {lines.map((line, i) => (
        <div key={i} className={lineClass(line)}>
          {line}
        </div>
      ))}
    </div>
  );
}
