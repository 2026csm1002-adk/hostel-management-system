import { shortId } from "@/lib/ids";
import { StatusChip } from "./StatusChip";

type Props = {
  id: string;
  typeLabel: string;      // "Complaint · Plumbing"
  title: string;          // the student's text
  meta: string;           // "Riya Sen · Room A-112 · 2 days ago"
  status: string;
  notes?: string[];       // small grey lines under the text
  children?: React.ReactNode; // action buttons
};

/** One request card, used by the staff queues. */
export function Ticket({ id, typeLabel, title, meta, status, notes = [], children }: Props) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-[3px] border border-line bg-white p-3.5">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11.5px] font-semibold text-ink-soft">{shortId(id)}</span>
          <span className="text-[11.5px] text-ink-soft">{typeLabel}</span>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-ink-soft">{meta}</div>
        {notes.map((n) => (
          <div key={n} className="mt-1.5 rounded-[3px] bg-paper px-2.5 py-1.5 text-xs text-ink-soft">
            {n}
          </div>
        ))}
        {children && <div className="mt-2.5 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <StatusChip status={status} />
    </li>
  );
}
