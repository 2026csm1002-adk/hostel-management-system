"use client";

import { useState } from "react";
import { AssignRoomForm } from "@/components/caretaker/AssignRoomForm";
import { ForwardForm } from "@/components/caretaker/ForwardForm";
import { Ticket } from "@/components/shared/Ticket";
import { useApi } from "@/components/shared/useApi";
import { errorMessage, sendJson } from "@/lib/api-client";
import type { CaretakerSwapDTO } from "@/types/caretaker";

const CARETAKER_CHANGED_EVENT = "caretaker:changed";
const btn = "rounded-[3px] border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold hover:border-ink disabled:opacity-50";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// The filter chips group the statuses by who has to act next.
const GROUPS: Record<string, string[] | null> = {
  All: null,
  "To forward": ["Pending"],
  "With warden": ["Forwarded", "Waiting"],
  "Room to assign": ["Accepted", "AwaitingRoom"],
  Closed: ["Rejected", "RoomAssigned"],
};
const ORDER = ["Pending", "Accepted", "AwaitingRoom", "Forwarded", "Waiting", "Rejected", "RoomAssigned"];
const NEEDS_ME = ["Pending", "Accepted", "AwaitingRoom"];

export function SwapQueue() {
  const { data, error, loading, reload } = useApi<{ swaps: CaretakerSwapDTO[] }>("/api/swaps");
  const [filter, setFilter] = useState("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(id: string, path: string, body?: unknown) {
    setBusyId(id);
    setActionError(null);
    try {
      await sendJson(`/api/swaps/${id}/${path}`, body);
    } catch (e) {
      setActionError(errorMessage(e)); // the list may be out of date, so it is reloaded below either way
    } finally {
      setBusyId(null);
      reload();
      window.dispatchEvent(new Event(CARETAKER_CHANGED_EVENT)); // refresh the numbers on the tabs
    }
  }

  const all = data?.swaps ?? [];
  const allowed = GROUPS[filter];
  const visible = all
    .filter((s) => !allowed || allowed.includes(s.status))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)); // what needs me comes first
  const needsMe = all.filter((s) => NEEDS_ME.includes(s.status)).length;
  const countIn = (group: string) => {
    const statuses = GROUPS[group];
    return statuses ? all.filter((s) => statuses.includes(s.status)).length : all.length;
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-[15px]">Swap requests</h3>
        <span className="font-mono text-xs text-ink-soft">{needsMe} need your action</span>
      </div>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {Object.keys(GROUPS).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full border px-3 py-1 text-xs font-semibold " +
              (filter === f ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")
            }
          >
            {f}
            {countIn(f) > 0 && <span className={"ml-1.5 font-mono " + (filter === f ? "text-white/80" : "text-ink-soft")}>{countIn(f)}</span>}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-brick">{error}</p>}
      {actionError && <p className="mb-3 text-sm text-brick">{actionError}</p>}

      {data === null && !error ? (
        <p className="text-sm text-ink-soft">Loading swap requests…</p>
      ) : visible.length === 0 && !error ? (
        <p className="rounded-[3px] border border-dashed border-line-strong p-[18px] text-center text-[13px] text-ink-soft">
          {all.length === 0 ? "No swap requests from your hostel yet." : "Nothing in this group."}
        </p>
      ) : (
        <ul className={"flex flex-col gap-2.5 " + (loading ? "opacity-70" : "")}>
          {visible.map((s) => {
            const busy = busyId === s.id;
            const notes = [
              ...(s.caretakerComment ? [`Your comment to the warden: ${s.caretakerComment}`] : []),
              ...(s.wardenComment ? [`Warden’s note: ${s.wardenComment}`] : []),
              ...(s.assignedRoom ? [`New room assigned: ${s.assignedRoom}`] : []),
              ...(s.status === "Forwarded" ? ["Waiting for the warden’s decision."] : []),
              ...(s.status === "Waiting" ? ["The warden put this on hold. It comes back to you only if it is accepted."] : []),
              ...(s.status === "Accepted" ? ["The warden accepted this request. Please assign a room."] : []),
              ...(s.status === "AwaitingRoom" ? ["Accepted, but no room was free. Assign one when it is."] : []),
            ];
            return (
              <Ticket
                key={s.id}
                id={s.id}
                typeLabel="Room swap"
                title={s.reason}
                meta={`${s.studentName} · Mobile ${s.mobileNo || "not given"} · Room ${s.wing}-${s.roomNo} · Batch ${s.batch} · ${s.course} · ${day(s.createdAt)}`}
                status={s.status}
                notes={notes}
              >
                {/* The student's document: opens in Google Drive in a new tab. */}
                {s.attachmentName &&
                  (s.attachmentUrl ? (
                    <a href={s.attachmentUrl} target="_blank" rel="noopener noreferrer" className={btn}>
                      View document · {s.attachmentName}
                    </a>
                  ) : (
                    <span className="text-xs text-ink-soft">Document: {s.attachmentName} (no link available)</span>
                  ))}
                {s.status === "Pending" && (
                  <ForwardForm swapId={s.id} busy={busy} onForward={(comment) => act(s.id, "forward", { comment })} />
                )}
                {(s.status === "Accepted" || s.status === "AwaitingRoom") && (
                  <AssignRoomForm
                    canMarkNoRoom={s.status === "Accepted"}
                    busy={busy}
                    onAssign={(room) => act(s.id, "assign-room", { room })}
                    onNoRoom={() => act(s.id, "awaiting-room")}
                  />
                )}
              </Ticket>
            );
          })}
        </ul>
      )}
    </section>
  );
}
