"use client";

import { useState } from "react";

const btn = "rounded-[3px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink disabled:opacity-50";
const COMMENT_MAX = 500;

/**
 * "Forward to warden" with an optional comment.
 * First click opens a comment box; the request is sent only after "Send to warden".
 * The comment can be left empty.
 */
export function ForwardForm({
  swapId,
  busy,
  onForward,
}: {
  swapId: string;
  busy: boolean;
  onForward: (comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  if (!open) {
    return (
      <button type="button" disabled={busy} onClick={() => setOpen(true)} className={btn}>
        Forward to warden
      </button>
    );
  }

  return (
    <div className="w-full">
      <label htmlFor={`fc-${swapId}`} className="mb-1 block text-xs font-semibold">
        Comment for the warden (optional)
      </label>
      <textarea
        id={`fc-${swapId}`}
        rows={2}
        maxLength={COMMENT_MAX}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything the warden should know about this request"
        className="w-full rounded-[3px] border border-line-strong bg-white px-2.5 py-2 text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onForward(comment.trim())}
          className="rounded-[3px] border border-ink bg-ink px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send to warden"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setComment("");
          }}
          className={btn}
        >
          Cancel
        </button>
        <span className="font-mono text-[11px] text-ink-soft">{comment.length}/{COMMENT_MAX}</span>
      </div>
    </div>
  );
}
