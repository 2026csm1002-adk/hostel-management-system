"use client";

import { Ticket, daysAgo } from "@/components/shared/Ticket";
import { useApi } from "@/components/shared/useApi";
import type { StaffSwapDTO } from "@/types";
import { DecisionPanel } from "./DecisionPanel";

const btnSm = "rounded-[3px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink";

function SwapTicket({ s, onDone }: { s: StaffSwapDTO; onDone: () => void }) {
  const actionable = s.status === "Forwarded"; // after the decision the warden is done; the caretaker assigns the room
  const notes = [
    ...(s.caretakerComment ? [`Note from caretaker · ${s.caretakerComment}`] : []),
    ...(s.wardenComment ? s.wardenComment.split("\n").map((l) => `Message to student · ${l}`) : []),
    ...(s.status === "Accepted" ? ["Accepted. The caretaker will assign a room."] : []),
    ...(s.status === "AwaitingRoom" ? ["Accepted. The caretaker is waiting for a free room."] : []),
    ...(s.status === "Waiting" ? ["Accepted. No room is free yet; the caretaker will assign one when it is."] : []),
    ...(s.assignedRoom ? [`New room assigned: ${s.assignedRoom}`] : []),
  ];
  return (
    <Ticket
      id={s.id}
      typeLabel="Room swap"
      ago={daysAgo(s.createdAt)}
      fields={[
        { label: "Name", value: s.studentName, bold: true },
        { label: "Email", value: s.email, breakAll: true },
        { label: "Mobile No.", value: s.mobileNo || "not given" },
        { label: "Room No.", value: `${s.wing}-${s.roomNo}` },
        { label: "Batch", value: s.batch },
        { label: "Course", value: s.course },
        { label: "Reason", value: s.reason, bold: true, wide: true },
      ]}
      status={s.status}
      notes={notes}
    >
      {/* The student's document: opens in Google Drive in a new tab. */}
      {s.attachmentName &&
        (s.attachmentUrl ? (
          <a href={s.attachmentUrl} target="_blank" rel="noopener noreferrer" className={btnSm}>
            View document · {s.attachmentName}
          </a>
        ) : (
          <span className="text-xs text-ink-soft">Document: {s.attachmentName} (no link available)</span>
        ))}
      {actionable && <DecisionPanel swapId={s.id} onDone={onDone} />}
    </Ticket>
  );
}

export function WardenSwaps() {
  const list = useApi<{ swaps: StaffSwapDTO[] }>("/api/swaps");

  const reloadAll = () => list.reload();

  const all = list.data?.swaps ?? [];
  const toDecide = all.filter((s) => s.status === "Forwarded");
  const decided = all.filter((s) => s.status !== "Forwarded");

  return (
    <div>
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
          <ul className={"flex flex-col gap-2 " + (list.loading ? "opacity-70" : "")}>
            {toDecide.map((x) => (
              <SwapTicket key={x.id} s={x} onDone={reloadAll} />
            ))}
          </ul>
        )}

        {decided.length > 0 && (
          <>
            <h3 className="mb-3 mt-7 text-[15px]">Already decided</h3>
            <ul className="flex flex-col gap-2">
              {decided.map((x) => (
                <SwapTicket key={x.id} s={x} onDone={reloadAll} />
              ))}
            </ul>
          </>
        )}
      </div>

    </div>
  );
}
