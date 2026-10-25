// Messages on a swap request. The caretaker and the warden each talk to the student on their own:
//   student   sees both conversations
//   caretaker sees only the caretaker's messages
//   warden    sees only the warden's messages
// They are kept as dated lines "25 Oct · Caretaker: text" in swap_request.warden_comment (no schema change),
// oldest first. The filtering is done here on the server, so the other person's messages never leave it.

export type NoteAuthor = "Warden" | "Caretaker";
export type NoteViewer = NoteAuthor | "Student";

const TAG = /^[^·\n]* · (Warden|Caretaker): /;

/** Adds a dated line. Line breaks in the text become spaces, so one message can never look like two. */
export function addNote(previous: string | null, author: NoteAuthor, text: string): string {
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const line = `${date} · ${author}: ${text.replace(/\s*[\r\n]+\s*/g, " ").trim()}`;
  return previous ? `${previous}\n${line}` : line;
}

/** The notes this person may see, or null when there are none. A line without a name is an old warden note. */
export function notesFor(raw: string | null, viewer: NoteViewer): string | null {
  if (!raw) return null;
  if (viewer === "Student") return raw;
  const mine = raw.split("\n").filter((line) => (TAG.exec(line)?.[1] ?? "Warden") === viewer);
  return mine.length ? mine.join("\n") : null;
}
