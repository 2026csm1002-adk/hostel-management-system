// Builds the downloadable files (CSV / PDF). Services call this; it never touches data itself.

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
