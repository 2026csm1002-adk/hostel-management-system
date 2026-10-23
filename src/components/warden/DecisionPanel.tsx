"use client";

import { useState } from "react";
import { errorMessage, sendJson } from "@/lib/api-client";

type Decision = "Accept" | "Reject" | "Waiting";

const btn = "rounded-[3px] border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const LABEL: Record<Decision, string> = { Accept: "Accept", Reject: "Reject", Waiting: "Mark waiting" };
const TONE: Record<Decision, string> = {
  Accept: "border-green bg-green text-white hover:opacity-90",
  Reject: "border-brick bg-brick text-white hover:opacity-90",
  Waiting: "border-amber bg-amber text-white hover:opacity-90",
};

/**
 * Accept / Reject / Mark waiting for one request.
 * Choosing a decision opens a comment box (required for Reject and Waiting, optional for Accept)
 * and the decision is sent only after "Confirm".
 */
export function DecisionPanel({
  swapId,
  status,
  onDone,
}: {
  swapId: string;
  status: string;
  onDone: () => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A request already on hold can still be accepted or rejected, but not put on hold again.
  const choices: Decision[] = status === "Waiting" ? ["Accept", "Reject"] : ["Accept", "Reject", "Waiting"];
  const needsComment = decision !== null && decision !== "Accept";

  async function confirm() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/swaps/${swapId}/decision`, { decision, comment: comment.trim() || undefined });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (!decision) {
    return (
      <>
        {choices.map((d) => (
          <button key={d} type="button" onClick={() => setDecision(d)} className={`${btn} ${TONE[d]}`}>
            {LABEL[d]}
          </button>
        ))}
      </>
    );
  }

  return (
    <div className="w-full">
      <label htmlFor={`c-${swapId}`} className="mb-1 block text-xs font-semibold">
        Comment for the student {needsComment ? "(required)" : "(optional)"}
      </label>
      <textarea
        id={`c-${swapId}`}
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={decision === "Reject" ? "Why is the request rejected?" : decision === "Waiting" ? "What are we waiting for?" : "Anything the student should know"}
        className="w-full rounded-[3px] border border-line-strong bg-white px-2.5 py-2 text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || (needsComment && comment.trim() === "")}
          onClick={confirm}
          className={`${btn} ${TONE[decision]}`}
        >
          {busy ? "Saving…" : `Confirm ${LABEL[decision].toLowerCase()}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setDecision(null);
            setError(null);
          }}
          className={`${btn} border-line-strong bg-white hover:border-ink`}
        >
          Cancel
        </button>
        {error && <span className="text-xs text-brick">{error}</span>}
      </div>
    </div>
  );
}
