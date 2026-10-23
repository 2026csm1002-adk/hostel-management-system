"use client";

import { Ticket } from "@/components/shared/Ticket";
import { useApi } from "@/components/shared/useApi";
import type { StaffSwapDTO, SwapStatsDTO } from "@/types";
import { CountBars } from "./CountBars";
import { DecisionPanel } from "./DecisionPanel";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function SwapTicket({ s, onDone }: { s: StaffSwapDTO; onDone: () => void }) {
  const decidable = s.status === "Forwarded" || s.status === "Waiting";
  const notes = [
    ...(s.attachmentName ? [`Attachment: ${s.attachmentName}`] : []),
    ...(s.wardenComment ? [`Your comment: ${s.wardenComment}`] : []),
    ...(s.status === "Accepted" ? ["Accepted. The caretaker will assign a room."] : []),
    ...(s.status === "AwaitingRoom" ? ["Accepted. The caretaker is waiting for a free room."] : []),
    ...(s.assignedRoom ? [`New room assigned: ${s.assignedRoom}`] : []),
  ];
  return (
    <Ticket
      id={s.id}
      typeLabel="Room swap"
      title={s.reason}
      meta={`${s.studentName} · Room ${s.wing}-${s.roomNo} · Batch ${s.batch} · ${s.course} · ${day(s.createdAt)}`}
      status={s.status}
      notes={notes}
    >
      {decidable && <DecisionPanel swapId={s.id} status={s.status} onDone={onDone} />}
    </Ticket>
  );
}

export function WardenSwaps() {
  const list = useApi<{ swaps: StaffSwapDTO[] }>("/api/swaps");
  const stats = useApi<{ stats: SwapStatsDTO }>("/api/swaps/stats");

  const reloadAll = () => {
    list.reload();
    stats.reload();
  };

  const all = list.data?.swaps ?? [];
  const toDecide = all.filter((s) => s.status === "Forwarded" || s.status === "Waiting");
  const decided = all.filter((s) => s.status !== "Forwarded" && s.status !== "Waiting");
  const s = stats.data?.stats;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {list.error && <p className="mb-3 text-sm text-brick">{list.error}</p>}

        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-[15px]">Needs your decision</h3>
          <span className="font-mono text-xs text-ink-soft">{toDecide.length} waiting</span>
        </div>
        {list.data === null && !list.error ? (
          <p className="text-sm text-ink-soft">Loading requests…</p>
        ) : toDecide.length === 0 ? (
          <p className="rounded-[3px] border border-dashed border-line-strong p-[18px] text-center text-[13px] text-ink-soft">
            Nothing to decide right now. Requests appear here after your caretaker forwards them.
          </p>
        ) : (
          <ul className={"flex flex-col gap-2.5 " + (list.loading ? "opacity-70" : "")}>
            {toDecide.map((x) => (
              <SwapTicket key={x.id} s={x} onDone={reloadAll} />
            ))}
          </ul>
        )}

        {decided.length > 0 && (
          <>
            <h3 className="mb-3 mt-7 text-[15px]">Already decided</h3>
            <ul className="flex flex-col gap-2.5">
              {decided.map((x) => (
                <SwapTicket key={x.id} s={x} onDone={reloadAll} />
              ))}
            </ul>
          </>
        )}
      </div>

      <aside className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px]">Requests in your hostel</h3>
          <span className="font-mono text-xs text-ink-soft">{s ? s.total : "–"} total</span>
        </div>
        {stats.error && <p className="text-sm text-brick">{stats.error}</p>}
        <CountBars title="By batch" rows={s?.byBatch ?? []} color="bg-indigo" />
        <CountBars title="By course" rows={s?.byCourse ?? []} color="bg-teal" />
        <p className="text-xs text-ink-soft">Counts only. They never show who made the requests.</p>
      </aside>
    </div>
  );
}
