// A tiny PDF writer (text only, A4, Helvetica) so exports need no extra library.
// Each section starts on a new page and flows onto more pages if it is long.
// Only Latin-1 characters can be written; anything else is shown as "?".

export type PdfSection = { heading: string; lines: string[] };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const BODY_SIZE = 11;
const LEADING = 15;
const MAX_CHARS = 88; // wrap width for 11pt Helvetica

function clean(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function esc(text: string): string {
  return clean(text).replace(/[\\()]/g, (c) => "\\" + c);
}

function wrap(text: string): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of clean(text).split(" ")) {
    let w = word;
    while (w.length > MAX_CHARS) {
      if (line) { out.push(line); line = ""; }
      out.push(w.slice(0, MAX_CHARS));
      w = w.slice(MAX_CHARS);
    }
    if ((line + " " + w).trim().length > MAX_CHARS) { out.push(line); line = w; }
    else line = (line + " " + w).trim();
  }
  out.push(line);
  return out;
}

export function buildPdf(sections: PdfSection[]): Uint8Array {
  // Lay out text into pages: each page is a list of { text, size, bold, y }.
  type Row = { text: string; size: number; bold: boolean; y: number };
  const pages: Row[][] = [];
  const bottom = MARGIN + 10;

  for (const section of sections.length ? sections : [{ heading: "No data", lines: [] }]) {
    let page: Row[] = [];
    let y = PAGE_H - MARGIN;
    const newPage = (continued: boolean) => {
      if (page.length) pages.push(page);
      page = [];
      y = PAGE_H - MARGIN;
      page.push({ text: section.heading + (continued ? " (continued)" : ""), size: 15, bold: true, y });
      y -= 30;
    };
    newPage(false);
    for (const raw of section.lines) {
      for (const text of wrap(raw)) {
        if (y < bottom) newPage(true);
        page.push({ text, size: BODY_SIZE, bold: false, y });
        y -= LEADING;
      }
    }
    pages.push(page);
  }

  // Objects: 1 catalog, 2 page tree, 3 regular font, 4 bold font, then (content, page) per page.
  const objects: string[] = [];
  const pageObjIds: number[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  let next = 5;
  for (const page of pages) {
    const stream = page
      .map((r) => `BT /${r.bold ? "F2" : "F1"} ${r.size} Tf ${MARGIN} ${r.y} Td (${esc(r.text)}) Tj ET`)
      .join("\n");
    const contentId = next++;
    const pageId = next++;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageObjIds.push(pageId);
  }
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`;

  // Everything is Latin-1, so one character = one byte and offsets are character counts.
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
