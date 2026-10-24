// Builds the complaint downloads (CSV / PDF / Excel) for the caretaker. Uses the same csv.ts and pdf.ts helpers
// as the rest of the project. It never touches data itself.

import ExcelJS from "exceljs";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { shortId } from "@/lib/ids";
import { buildPdf, type PdfSection } from "@/lib/pdf";
import type { ExportFile } from "@/server/services/export.service";
import type { StaffComplaintDTO } from "@/types/caretaker";

// Excel sheet names: max 31 characters, and none of  \ / ? * [ ] :
const sheetName = (s: string) => s.replace(/[\/?*[\]:]/g, " ").slice(0, 31);

export const complaintExportService = {
  /** One CSV row per complaint. Opens in Excel; text that looks like a formula is made safe. */
  csv(rows: StaffComplaintDTO[], filename: string): ExportFile {
    const csv = toCsv(
      ["Ticket", "Category", "Description", "Student", "Mobile", "Wing", "Room", "Status", "Submitted"],
      rows.map((c) => [shortId(c.id), c.category, c.description, c.studentName, c.mobileNo, c.wing, c.roomNo, c.status, c.createdAt.slice(0, 10)]),
    );
    // The leading BOM makes Excel read the file as UTF-8.
    return { filename, contentType: "text/csv; charset=utf-8", body: "\uFEFF" + csv };
  },

  /** Excel: one sheet per category. Room No = "wing-room" in one column. */
  async xlsx(
    rows: StaffComplaintDTO[],
    filename: string,
    categories: readonly string[] = COMPLAINT_CATEGORIES,
  ): Promise<ExportFile> {
    const wb = new ExcelJS.Workbook();
    for (const category of categories) {
      const ws = wb.addWorksheet(sheetName(category));
      ws.columns = [
        { header: "Ticket ID", key: "ticket", width: 14 },
        { header: "Name", key: "name", width: 24 },
        { header: "Email", key: "email", width: 32 },
        { header: "Room No", key: "room", width: 12 },
        { header: "Contact Number", key: "contact", width: 18 },
        { header: "Reason", key: "reason", width: 60 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      for (const c of rows.filter((r) => r.category === category)) {
        ws.addRow({
          ticket: shortId(c.id),
          name: c.studentName,
          email: c.email,
          room: `${c.wing}-${c.roomNo}`,
          contact: c.mobileNo,
          reason: c.description,
        });
      }
      ws.getColumn("reason").alignment = { wrapText: true, vertical: "top" };
    }
    const body = new Uint8Array(await wb.xlsx.writeBuffer());
    return {
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body,
    };
  },

  /** One page per complaint, laid out like the prototype. */
  pdf(rows: StaffComplaintDTO[], hostelName: string, filename: string): ExportFile {
    const sections: PdfSection[] = rows.map((c) => ({
      heading: `Hostel complaint - ${shortId(c.id)}`,
      lines: [
        `Hostel: ${hostelName}`,
        `Category: ${c.category}`,
        `Student: ${c.studentName}  (mobile ${c.mobileNo || "not given"})`,
        `Room: ${c.wing}-${c.roomNo}`,
        `Status: ${c.status}`,
        `Submitted: ${c.createdAt.slice(0, 10)}`,
        "",
        `Description: ${c.description}`,
      ],
    }));
    if (sections.length === 0) sections.push({ heading: `Complaints - ${hostelName}`, lines: ["No complaints."] });
    return { filename, contentType: "application/pdf", body: buildPdf(sections) };
  },
};
