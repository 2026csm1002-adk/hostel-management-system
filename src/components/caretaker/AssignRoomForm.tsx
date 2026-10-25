"use client";

import { useState } from "react";
import { MessageForm } from "@/components/shared/MessageForm";

const btn = "rounded-[3px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink disabled:opacity-50";

/**
 * The room box of an accepted request: type the new room and Assign room, or Mark waiting when no room is free
 * (that needs a message for the student). "Mark waiting" is offered only until the request is already waiting.
 */
export function AssignRoomForm({
  swapId,
  canMarkWaiting,
  busy,
  onAssign,
  onWaiting,
}: {
  swapId: string;
  canMarkWaiting: boolean;
  busy: boolean;
  onAssign: (room: string) => void;
  onWaiting: (message: string) => Promise<void>;
}) {
  const [room, setRoom] = useState("");
  return (
    <>
      <input
        aria-label="New room number"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="New room, e.g. 214"
        maxLength={10}
        className="w-40 rounded-[3px] border border-line-strong bg-white px-2.5 py-1 text-xs"
      />
      <button type="button" disabled={busy || room.trim() === ""} onClick={() => onAssign(room.trim())} className={btn}>
        Assign room
      </button>
      {canMarkWaiting && (
        <MessageForm
          id={`w-${swapId}`}
          buttonLabel="Mark waiting"
          label="Message for the student: why they are waiting"
          placeholder="e.g. No room is free right now. You will get one as soon as it is"
          confirmLabel="Confirm waiting"
          disabled={busy}
          onSend={onWaiting}
        />
      )}
    </>
  );
}
