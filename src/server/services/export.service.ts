// Builds the downloadable files (Excel / PDF / CSV). Services call this; it never touches data itself.

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toCsv } from "@/lib/csv";
import { formatDateLabel } from "@/lib/dates";
import { buildPdf, type PdfSection } from "@/lib/pdf";

export type ExportFile = { filename: string; contentType: string; body: string | Uint8Array };

export type ScheduleRow = {
  date: string; // YYYY-MM-DD
  hostelName: string;
  floor: number;
  floorLabel: string;
  slotStart: string;
  slotLabel: string;
  roomNo: string;
};

function sorted(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.hostelName.localeCompare(b.hostelName) ||
      a.floor - b.floor ||
      a.slotStart.localeCompare(b.slotStart) ||
      a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }),
  );
}

export const exportService = {
  scheduleCsv(rows: ScheduleRow[], filename: string): ExportFile {
    const csv = toCsv(
      ["Date", "Hostel", "Floor", "Slot", "Room Number"],
      sorted(rows).map((r) => [r.date, r.hostelName, r.floorLabel, r.slotLabel, r.roomNo]),
    );
    // The leading BOM makes Excel read the file as UTF-8.
    return { filename, contentType: "text/csv; charset=utf-8", body: "\uFEFF" + csv };
  },

  /** One page per date; inside it one line per hostel, floor and slot, listing the rooms. */
  schedulePdf(rows: ScheduleRow[], dates: string[], title: string, filename: string): ExportFile {
    const all = sorted(rows);
    const sections: PdfSection[] = dates.map((date) => {
      const day = all.filter((r) => r.date === date);
      const lines: string[] = [];
      const groups = new Map<string, string[]>();
      for (const r of day) {
        const key = `${r.hostelName} | ${r.floorLabel} | ${r.slotLabel}`;
        groups.set(key, [...(groups.get(key) ?? []), r.roomNo]);
      }
      for (const [key, rooms] of groups) lines.push(`${key}  -  Rooms: ${rooms.join(", ")}`);
      if (lines.length === 0) lines.push("No bookings for this day.");
      return { heading: `${title} - ${formatDateLabel(date)} ${date.slice(0, 4)}`, lines };
    });
    return { filename, contentType: "application/pdf", body: buildPdf(sections) };
  },
};

// ---------------------------------------------------------------------------
// Wing-wise schedule (supervisor): one Excel sheet per wing; T6 one sheet for all its wings.
// scheduleCsv / schedulePdf above are kept unchanged so nothing else breaks.
// ---------------------------------------------------------------------------

export type WingScheduleRow = {
  date: string; // YYYY-MM-DD
  hostelName: string;
  groupLabel: string; // the wing ("SE"), or "All wings" where the wings share slots (T6)
  wing: string; // the wing of the room ("" when unknown)
  floor: number;
  floorLabel: string;
  slotStart: string;
  slotLabel: string;
  roomNo: string;
  roomLabel: string; // room number, plus the wing where wings share slots: "105 (C)"
};

/** One Excel sheet: the bookings of one wing (T6: of all wings together). */
export type WingSheet = { name: string; rows: WingScheduleRow[] };

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sortedWing(rows: WingScheduleRow[]): WingScheduleRow[] {
  return [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.hostelName.localeCompare(b.hostelName) ||
      a.groupLabel.localeCompare(b.groupLabel) ||
      a.floor - b.floor ||
      a.slotStart.localeCompare(b.slotStart) ||
      a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }),
  );
}

/** Excel allows at most 31 characters, none of  \\ / ? * [ ] :  and no duplicate names. */
function sheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

export const wingExportService = {
  /** One workbook, one sheet per wing. A wing without bookings still gets its (empty) sheet. */
  async scheduleXlsx(sheets: WingSheet[], filename: string): Promise<ExportFile> {
    const workbook = new ExcelJS.Workbook();
    const used = new Set<string>();
    for (const sheet of sheets.length ? sheets : [{ name: "Schedule", rows: [] as WingScheduleRow[] }]) {
      const ws = workbook.addWorksheet(sheetName(sheet.name, used), { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Date", key: "date", width: 13 },
        { header: "Hostel", key: "hostel", width: 16 },
        { header: "Wing", key: "wing", width: 12 },
        { header: "Floor", key: "floor", width: 14 },
        { header: "Slot", key: "slot", width: 20 },
        { header: "Room Number", key: "room", width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const r of sortedWing(sheet.rows)) {
        ws.addRow({
          date: r.date,
          hostel: r.hostelName,
          wing: r.wing || r.groupLabel,
          floor: r.floorLabel,
          slot: r.slotLabel,
          room: r.roomNo,
        });
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return { filename, contentType: XLSX_TYPE, body: new Uint8Array(buffer as ArrayBuffer) };
  },

  /**
   * The PDF for the cleaning staff, laid out like the prototype: one page per date with a table
   * (Wing | Floor | Slot | Rooms to clean). Only slots that have bookings get a row.
   * `showHostel` adds a Hostel column (used when the export covers all hostels).
   */
  schedulePdf(rows: WingScheduleRow[], dates: string[], scope: string, filename: string, showHostel = false): ExportFile {
    const all = sortedWing(rows);
    const doc = new jsPDF();
    dates.forEach((date, i) => {
      if (i > 0) doc.addPage();
      doc.setFontSize(15);
      doc.text(`Cleaning Schedule \u2014 ${formatDateLabel(date)} ${date.slice(0, 4)}`, 14, 18);
      doc.setFontSize(11);
      doc.text(scope, 14, 25);

      // one row per hostel, wing, floor and slot; the rooms of that slot in one cell
      const groups = new Map<string, { hostel: string; wing: string; floor: string; slot: string; rooms: string[] }>();
      for (const r of all.filter((x) => x.date === date)) {
        const key = `${r.hostelName}|${r.groupLabel}|${r.floor}|${r.slotStart}`;
        const g = groups.get(key) ?? { hostel: r.hostelName, wing: r.groupLabel, floor: r.floorLabel, slot: r.slotLabel, rooms: [] };
        g.rooms.push(r.roomLabel);
        groups.set(key, g);
      }
      const head = [showHostel ? ["Hostel", "Wing", "Floor", "Slot", "Rooms to clean"] : ["Wing", "Floor", "Slot", "Rooms to clean"]];
      const body = [...groups.values()].map((g) => {
        const cells = [g.wing, g.floor, g.slot, g.rooms.join(", ")];
        return showHostel ? [g.hostel, ...cells] : cells;
      });
      if (body.length === 0) body.push([{ content: "No bookings for this day.", colSpan: head[0].length } as never]);
      autoTable(doc, { startY: 31, head, body });
    });
    return { filename, contentType: "application/pdf", body: new Uint8Array(doc.output("arraybuffer")) };
  },
};
