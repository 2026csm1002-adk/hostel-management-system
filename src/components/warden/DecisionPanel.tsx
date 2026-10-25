"use client";

import { useState } from "react";
import { errorMessage, sendJson } from "@/lib/api-client";

type Action = "Accept" | "Reject";

const btn = "rounded-[3px] border px-2.5 py-1 text-xs font-semibold disabled:opacity-50";
const NEUTRAL = "border-line-strong bg-white hover:border-ink";
const LABEL: Record<Action, string> = { Accept: "Accept", Reject: "Reject" };
const TONE: Record<Action, string> = {
  Accept: "border-green bg-green text-white hover:opacity-90",
  Reject: "border-brick bg-brick text-white hover:opacity-90",
};
const PLACEHOLDER: Record<Action, string> = {
  Accept: "Anything the student should know",
  Reject: "Why is the request rejected? (you can leave this empty)",
};
const SEND_LABEL: Record<Action, string> = { Accept: "Confirm accept", Reject: "Confirm reject" };

/**
 * What the warden does with a forwarded request: Accept or Reject (the comment is optional for both).
 * Once the request is accepted the warden's work is done; the caretaker assigns the room.
 */
export function DecisionPanel({ swapId, onDone }: { swapId: string; onDone: () => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!action) return;
    const text = comment.trim();
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/swaps/${swapId}/decision`, { decision: action, comment: text || undefined });
      setAction(null);
      setComment("");
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!action) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        {(["Accept", "Reject"] as Action[]).map((a) => (
          <button key={a} type="button" onClick={() => setAction(a)} className={`${btn} ${TONE[a]}`}>
            {LABEL[a]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <label htmlFor={`c-${swapId}`} className="mb-1 block text-xs font-semibold">
        Comment for the student (optional)
      </label>
      <textarea
        id={`c-${swapId}`}
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={PLACEHOLDER[action]}
        className="w-full rounded-[3px] border border-line-strong bg-white px-2.5 py-2 text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={confirm} className={`${btn} ${TONE[action]}`}>
          {busy ? "Saving…" : SEND_LABEL[action]}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setAction(null);
            setError(null);
          }}
          className={`${btn} ${NEUTRAL}`}
        >
          Cancel
        </button>
        {error && <span className="text-xs text-brick">{error}</span>}
      </div>
    </div>
  );
}
