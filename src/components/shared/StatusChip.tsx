// One chip for every status of every request type. Full class names are written out
// so Tailwind can see them.
const STYLES: Record<string, { label: string; className: string }> = {
  Open: { label: "Open", className: "bg-amber-soft text-amber" },
  InProgress: { label: "In progress", className: "bg-indigo-soft text-indigo" },
  Resolved: { label: "Resolved", className: "bg-green-soft text-green" },
  Confirmed: { label: "Confirmed", className: "bg-teal-soft text-teal" },
  Done: { label: "Done", className: "bg-green-soft text-green" },
  Pending: { label: "Pending", className: "bg-amber-soft text-amber" },
  Forwarded: { label: "Forwarded", className: "bg-indigo-soft text-indigo" },
  Accepted: { label: "Accepted", className: "bg-green-soft text-green" },
  AwaitingRoom: { label: "Awaiting room", className: "bg-amber-soft text-amber" },
  RoomAssigned: { label: "Room assigned", className: "bg-green-soft text-green" },
  Rejected: { label: "Rejected", className: "bg-brick-soft text-brick" },
  Waiting: { label: "Waiting", className: "bg-amber-soft text-amber" },
};

/** `square` = the small square badge used on the ticket cards (same as the caretaker complaint cards). */
export function StatusChip({ status, square = false }: { status: string; square?: boolean }) {
  const s = STYLES[status] ?? { label: status, className: "bg-paper text-ink-soft" };
  return (
    <span
      className={
        "whitespace-nowrap font-mono text-[11.5px] font-semibold " +
        (square ? "h-fit flex-none rounded-[3px] px-[9px] py-0.5 " : "rounded-full px-2.5 py-1 ") +
        s.className
      }
    >
      {s.label}
    </span>
  );
}
