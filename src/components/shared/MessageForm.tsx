"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api-client";

const btn = "rounded-[3px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink disabled:opacity-50";
const MAX = 500;

/**
 * A button that opens a message box. The message is sent only after the confirm button.
 * It closes and clears itself when the send worked, and shows the error when it did not.
 */
export function MessageForm({
  id,
  buttonLabel,
  label,
  placeholder,
  confirmLabel,
  required = true,
  disabled = false,
  onSend,
}: {
  id: string;
  buttonLabel: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  required?: boolean;
  disabled?: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await onSend(text.trim());
      setText("");
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={btn}>
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="w-full">
      <label htmlFor={`m-${id}`} className="mb-1 block text-xs font-semibold">
        {label} {required ? "(required)" : "(optional)"}
      </label>
      <textarea
        id={`m-${id}`}
        rows={2}
        maxLength={MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[3px] border border-line-strong bg-white px-2.5 py-2 text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || (required && text.trim() === "")}
          onClick={send}
          className="rounded-[3px] border border-ink bg-ink px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : confirmLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setText("");
            setError(null);
          }}
          className={btn}
        >
          Cancel
        </button>
        <span className="font-mono text-[11px] text-ink-soft">
          {text.length}/{MAX}
        </span>
        {error && <span className="text-xs text-brick">{error}</span>}
      </div>
    </div>
  );
}
