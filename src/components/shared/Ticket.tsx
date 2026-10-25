import { shortId } from "@/lib/ids";
import { StatusChip } from "./StatusChip";

/** "today", "1 day ago", "3 days ago" (same wording as the caretaker complaint cards). */
export function daysAgo(iso: string): string {
  const n = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return n === 0 ? "today" : `${n} day${n === 1 ? "" : "s"} ago`;
}

export type TicketField = {
  label: string;      // "Name"
  value: string;      // "Riya Sen"
  bold?: boolean;     // semi-bold value (names, reasons)
  wide?: boolean;     // take the full row
  breakAll?: boolean; // for long values such as e-mail addresses
};

type Props = {
  id: string;
  typeLabel: string;          // "Room swap"  -> shown as "Type: Room swap"
  ago?: string;               // "2 days ago"
  fields: TicketField[];      // the "Label: value" details
  status: string;
  notes?: string[];           // small highlighted lines under the details
  children?: React.ReactNode; // action buttons / links
};

/**
 * One request card, used by the caretaker swap queue and the warden page.
 * Same look as the caretaker complaint cards: perforated ticket edge, "Ticket ID",
 * "Label: value" grid, status badge on the right.
 */
export function Ticket({ id, typeLabel, ago, fields, status, notes = [], children }: Props) {
  return (
    <li className="relative flex gap-3 rounded-r-[3px] border border-l-0 border-[#D7DEDA] bg-white py-2 pr-3 pl-[18px] text-[13px] leading-[1.35]">
      {/* perforated ticket edge */}
      <span
        aria-hidden
        className="-my-2 -ml-[18px] w-2.5 flex-none border-r border-dashed border-[#B9C3BD]"
        style={{ backgroundImage: "radial-gradient(circle, #EEF2F1 1.6px, transparent 1.7px)", backgroundSize: "10px 10px", backgroundPosition: "center" }}
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono text-[11.5px] font-semibold text-black">Ticket ID: {shortId(id)}</span>
          {ago && <span className="text-xs text-ink-soft">{ago}</span>}
        </p>
        <p className="mb-1 text-xs font-semibold text-black">Type: {typeLabel}</p>

        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
          {fields.map((f) => (
            <p key={f.label} className={(f.wide ? "sm:col-span-2 " : "") + (f.breakAll ? "break-all " : "") + "whitespace-pre-wrap"}>
              <span className="text-ink-soft">{f.label}: </span>
              <span className={f.bold ? "font-semibold" : undefined}>{f.value}</span>
            </p>
          ))}
        </div>

        {notes.map((n, i) => (
          <div key={i} className="mt-1.5 rounded-[2px] border-l-[3px] border-[#3B4C86] bg-[#EEF2F1] px-2 py-1 text-xs">
            {n}
          </div>
        ))}

        {children && <div className="mt-1.5 flex flex-wrap items-center gap-2">{children}</div>}
      </div>

      <StatusChip status={status} square />
    </li>
  );
}
