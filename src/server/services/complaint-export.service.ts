// Builds the complaint downloads (CSV / PDF / Excel) for the caretaker. Uses the same csv.ts and pdf.ts helpers
// as the rest of the project. It never touches data itself.

import ExcelJS from "exceljs";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { shortId } from "@/lib/ids";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { isoDateInZone } from "@/lib/dates";
import type { ExportFile } from "@/server/services/export.service";
import type { StaffComplaintDTO } from "@/types/caretaker";

// Excel sheet names: max 31 characters, and none of  \ / ? * [ ] :
const sheetName = (s: string) => s.replace(/[\/?*[\]:]/g, " ").slice(0, 31);

const STATUS_LABEL: Record<string, string> = { Open: "New", InProgress: "In process", Resolved: "Resolved" };
const RANK: Record<string, number> = { Open: 0, InProgress: 1, Resolved: 2 };
const dateOf = (iso: string) => isoDateInZone(new Date(iso));

/** New complaints first, then in-process ones; inside each group the given (newest-first) order is kept. */
const byStatus = (rows: StaffComplaintDTO[]) => [...rows].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));

/** The columns of the Excel file; `showStatus` adds a Status column (for the "all complaints" files). */
function columns(showStatus: boolean) {
  return [
    { header: "Ticket ID", get: (c: StaffComplaintDTO) => shortId(c.id), width: 14 },
    { header: "Name", get: (c: StaffComplaintDTO) => c.studentName, width: 24 },
    { header: "Email", get: (c: StaffComplaintDTO) => c.email, width: 32 },
    { header: "Room No", get: (c: StaffComplaintDTO) => `${c.wing}-${c.roomNo}`, width: 12 },
    { header: "Contact Number", get: (c: StaffComplaintDTO) => c.mobileNo, width: 18 },
    { header: "Reason", get: (c: StaffComplaintDTO) => c.description, width: 60 },
    { header: "Date", get: (c: StaffComplaintDTO) => dateOf(c.createdAt), width: 13 },
    ...(showStatus ? [{ header: "Status", get: (c: StaffComplaintDTO) => STATUS_LABEL[c.status] ?? c.status, width: 12 }] : []),
  ];
}

export type ExportOptions = { showStatus?: boolean; categories?: readonly string[] };

export const complaintExportService = {
  /**
   * CSV in the same layout as the Excel file: one block per category (category name, column headings,
   * then its complaints). `showStatus` adds a Status column.
   */
  csv(rows: StaffComplaintDTO[], filename: string, { showStatus = false, categories = COMPLAINT_CATEGORIES }: ExportOptions = {}): ExportFile {
    const cols = columns(showStatus);
    const blocks: string[] = [];
    for (const category of categories) {
      const mine = byStatus(rows.filter((r) => r.category === category));
      if (mine.length === 0) continue;
      blocks.push(
        toCsv([category], []) + "\r\n" + toCsv(cols.map((c) => c.header), mine.map((c) => cols.map((col) => col.get(c)))),
      );
    }
    const csv = blocks.length ? blocks.join("\r\n\r\n") : toCsv(["No complaints"], []);
    // The leading BOM makes Excel read the file as UTF-8.
    return { filename, contentType: "text/csv; charset=utf-8", body: "\uFEFF" + csv };
  },

  /** Excel: one sheet (page) per category, with a highlighted header row. */
  async xlsx(rows: StaffComplaintDTO[], filename: string, { showStatus = false, categories = COMPLAINT_CATEGORIES }: ExportOptions = {}): Promise<ExportFile> {
    const cols = columns(showStatus);
    const wb = new ExcelJS.Workbook();
    for (const category of categories) {
      const ws = wb.addWorksheet(sheetName(category));
      ws.columns = cols.map((c) => ({ header: c.header, key: c.header, width: c.width }));
      // highlighted header row
      const header = ws.getRow(1);
      header.height = 22;
      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8791F" } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
      ws.views = [{ state: "frozen", ySplit: 1 }];
      for (const c of byStatus(rows.filter((r) => r.category === category))) {
        ws.addRow(Object.fromEntries(cols.map((col) => [col.header, col.get(c)])));
      }
      ws.getColumn("Reason").alignment = { wrapText: true, vertical: "top" };
    }
    const body = new Uint8Array(await wb.xlsx.writeBuffer());
    return { filename, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body };
  },

  /** PDF: every category starts on its own page, with a highlighted title bar and table header. */
  pdf(
    rows: StaffComplaintDTO[],
    hostelName: string,
    filename: string,
    { showStatus = false, categories = COMPLAINT_CATEGORIES, title = "Complaints" }: ExportOptions & { title?: string } = {},
  ): ExportFile {
    const cols = columns(showStatus);
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const fixed: Record<string, number> = { "Ticket ID": 22, Name: 32, Email: 56, "Room No": 18, "Contact Number": 28, Date: 22, Status: 22 };
    const columnStyles = Object.fromEntries(
      cols.map((c, i) => [i, fixed[c.header] ? { cellWidth: fixed[c.header] } : {}]), // Reason takes the rest
    );
    categories.forEach((category, i) => {
      if (i > 0) doc.addPage(); // a new page for every category
      const mine = byStatus(rows.filter((r) => r.category === category));

      // highlighted title bar
      doc.setFillColor(184, 121, 31);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(`${category} complaints - ${title}`, 14, 13);
      doc.setFontSize(10);
      doc.text(`${hostelName}  |  ${mine.length} complaint${mine.length === 1 ? "" : "s"}`, 14, 21);
      doc.setTextColor(0, 0, 0);

      if (mine.length === 0) {
        doc.setFontSize(11);
        doc.text("No complaints.", 14, 38);
        return;
      }
      autoTable(doc, {
        startY: 34,
        head: [cols.map((c) => c.header)],
        body: mine.map((c) => cols.map((col) => col.get(c))),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 240] },
        columnStyles,
      });
    });
    return { filename, contentType: "application/pdf", body: new Uint8Array(doc.output("arraybuffer")) };
  },
};
