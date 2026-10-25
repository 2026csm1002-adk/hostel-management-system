"use client";

import { useState } from "react";

const btn = "rounded-[3px] border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold hover:border-ink disabled:opacity-50";

/**
 * The room box of an accepted request: type the new room and Assign room, or say that no room is free yet.
 * "No room available" is offered only while the request is still Accepted (not again once it is waiting for a room).
 */
export function AssignRoomForm({
  canMarkNoRoom,
  busy,
  onAssign,
  onNoRoom,
}: {
  canMarkNoRoom: boolean;
  busy: boolean;
  onAssign: (room: string) => void;
  onNoRoom: () => void;
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
        className="w-40 rounded-[3px] border border-line-strong bg-white px-2.5 py-1.5 text-xs"
      />
      <button type="button" disabled={busy || room.trim() === ""} onClick={() => onAssign(room.trim())} className={btn}>
        Assign room
      </button>
      {canMarkNoRoom && (
        <button type="button" disabled={busy} onClick={onNoRoom} className={btn}>
          No room available
        </button>
      )}
    </>
  );
}
