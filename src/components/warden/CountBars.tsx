import type { CountRow } from "@/types";

/** Horizontal bars for anonymous counts (requests per batch or per course). */
export function CountBars({ title, rows, color }: { title: string; rows: CountRow[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-[3px] border border-line bg-white p-4">
      <h4 className="mb-3 text-[13px]">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-soft">No requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5 text-xs">
              <span className="w-14 shrink-0 font-mono font-semibold">{r.label}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-[2px] bg-paper">
                <span
                  className={`block h-full rounded-[2px] ${color}`}
                  style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }}
                />
              </span>
              <span className="w-6 text-right font-mono font-semibold">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
