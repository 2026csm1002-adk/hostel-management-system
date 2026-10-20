// Turns rows into CSV text. Quotes cells containing commas, quotes or line breaks.
// Cells that start with = + - @ are prefixed with ' so Excel cannot run them as formulas
// (students type the complaint text, so it is untrusted).

function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
