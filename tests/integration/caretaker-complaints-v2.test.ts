import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";
import { wingsOf } from "@/lib/hostels";
import { complaintExportQuerySchema } from "@/lib/validators/caretaker-complaint.schema";
import { memory, resetMemoryStore, type StudentRow } from "@/server/db/memory-store";
import { mobileRepo } from "@/server/repositories/mobile.repo";
import { studentRepo } from "@/server/repositories/student.repo";
import { resolveRole } from "@/server/services/auth.service";
import { caretakerComplaintService as caretaker } from "@/server/services/caretaker-complaint.service";
import { complaintService } from "@/server/services/complaint.service";
import type { SessionUser } from "@/types";

// Same set-up as caretaker-complaints.test.ts: no database, students in a Map, complaints in the in-memory store.
const students = new Map<string, StudentRow>();
studentRepo.findById = async (id) => students.get(id);
studentRepo.findByEmail = async (email) => [...students.values()].find((s) => s.googleEmail === email);

const file = path.join(tmpdir(), `hms-caretaker-v2-${process.pid}.json`);
writeFileSync(
  file,
  JSON.stringify([
    { name: "C1", email: "c1@iitrpr.ac.in", role: "Caretaker", hostel: "satluj" },
    { name: "C2", email: "c2@iitrpr.ac.in", role: "Caretaker", hostel: "beas" },
    { name: "W1", email: "w1@iitrpr.ac.in", role: "Warden", hostel: "satluj" },
  ]),
);
process.env.DEV_STAFF_FILE = file;

const email = (n: number) => `2026csm10${String(n).padStart(2, "0")}@iitrpr.ac.in`;
async function asUser(e: string): Promise<SessionUser> {
  return { email: e, ...(await resolveRole(e)) };
}
async function student(n: number, hostelId: string, wing = wingsOf(hostelId)[0], room = "207") {
  const studentId = `2026CSM10${String(n).padStart(2, "0")}`;
  students.set(studentId, {
    studentId, fullName: `Student ${n}`, googleEmail: email(n), hostelId, wing, roomNo: room, course: "MTech", batch: "2026",
  });
  await mobileRepo.set(studentId, `98765432${String(n).padStart(2, "0")}`);
}
const complain = (n: number, category: "Plumbing" | "Electrical" | "Carpenter", description = "Something is broken") =>
  complaintService.create(email(n), { category, description });
const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const row = (id: string) => memory.complaints.find((c) => c.complaintId === id)!;
const text = (f: { body: string | Uint8Array }) => (typeof f.body === "string" ? f.body : "");
async function workbook(f: { body: string | Uint8Array }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(f.body as Uint8Array) as never);
  return wb;
}

describe("Caretaker complaints: card data", () => {
  beforeEach(() => {
    resetMemoryStore();
    students.clear();
  });

  it("each complaint carries the student's name, email, mobile, wing-room, category, reason and age", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj", "SE", "105");
    await complain(1, "Electrical", "Fan broken");
    const [c] = await caretaker.list(c1);
    expect(c).toMatchObject({
      studentName: "Student 1",
      email: email(1),
      mobileNo: "9876543201",
      wing: "SE",
      roomNo: "105",
      category: "Electrical",
      description: "Fan broken",
      status: "Open",
      daysOld: 0,
    });
  });
});

describe("Caretaker complaints: resolved ones vanish after 2 days", () => {
  beforeEach(() => {
    resetMemoryStore();
    students.clear();
  });

  it("a complaint resolved 3 days ago is gone, one resolved 1 day ago is still listed", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const old = await complain(1, "Plumbing", "Old tap");
    const fresh = await complain(1, "Electrical", "Fresh fan");
    await caretaker.updateStatus(c1, old.id, "Resolved");
    await caretaker.updateStatus(c1, fresh.id, "Resolved");
    row(old.id).resolvedAt = ago(3);
    row(fresh.id).resolvedAt = ago(1);

    expect((await caretaker.list(c1)).map((c) => c.description)).toEqual(["Fresh fan"]);
  });

  it("just resolved is listed; just over 2 days is hidden", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const a = await complain(1, "Plumbing");
    await caretaker.updateStatus(c1, a.id, "Resolved");
    expect(await caretaker.list(c1)).toHaveLength(1);

    row(a.id).resolvedAt = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000 + 60 * 1000)).toISOString();
    expect(await caretaker.list(c1)).toHaveLength(0);
  });

  it("it is hidden from the caretaker only; the student still sees it in their own list", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const made = await complain(1, "Plumbing");
    await caretaker.updateStatus(c1, made.id, "Resolved");
    row(made.id).resolvedAt = ago(5);

    expect(await caretaker.list(c1)).toHaveLength(0);
    const mine = await complaintService.listMine(email(1));
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe("Resolved");
  });

  it("new and in-process complaints never vanish, however old they are", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const a = await complain(1, "Plumbing", "Still new");
    const b = await complain(1, "Electrical", "Being fixed");
    await caretaker.updateStatus(c1, b.id, "InProgress");
    row(a.id).createdAt = ago(60);
    row(b.id).createdAt = ago(60);

    const list = await caretaker.list(c1);
    expect(list.map((c) => c.status).sort()).toEqual(["InProgress", "Open"]);
  });

  it("a resolved complaint with no resolved time is kept (we cannot tell how old it is)", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const a = await complain(1, "Plumbing");
    row(a.id).status = "Resolved";
    row(a.id).resolvedAt = null;
    expect(await caretaker.list(c1)).toHaveLength(1);
  });

  it("the category list follows the same rule", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const a = await complain(1, "Plumbing");
    await complain(1, "Plumbing");
    await caretaker.updateStatus(c1, a.id, "Resolved");
    row(a.id).resolvedAt = ago(4);
    expect(await caretaker.list(c1, "Plumbing")).toHaveLength(1);
  });
});

describe("Caretaker complaints: Excel download", () => {
  beforeEach(() => {
    resetMemoryStore();
    students.clear();
  });

  it("has one sheet per category with the columns Ticket ID, Name, Email, Room No, Contact Number, Reason", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    const f = await caretaker.export(c1, "xlsx");
    expect(f.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(f.filename).toMatch(/^complaints-satluj-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const wb = await workbook(f);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...COMPLAINT_CATEGORIES]);
    for (const ws of wb.worksheets) {
      expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual([
        "Ticket ID", "Name", "Email", "Room No", "Contact Number", "Reason",
      ]);
      expect(ws.rowCount).toBe(1); // header only: nothing new yet
    }
  });

  it("puts each NEW complaint on the sheet of its category, with wing-room in one column", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj", "SE", "105");
    await complain(1, "Plumbing", "Tap leaks");
    await complain(1, "Electrical", "Fan broken");

    const wb = await workbook(await caretaker.export(c1, "xlsx"));
    const plumbing = wb.getWorksheet("Plumbing")!;
    expect(plumbing.rowCount).toBe(2);
    const [, ticket, name, mail, room, contact, reason] = plumbing.getRow(2).values as unknown[];
    expect(String(ticket)).not.toBe("");
    expect(name).toBe("Student 1");
    expect(mail).toBe(email(1));
    expect(room).toBe("SE-105");
    expect(contact).toBe("9876543201");
    expect(reason).toBe("Tap leaks");
    expect(wb.getWorksheet("Electrical")!.rowCount).toBe(2);
    expect(wb.getWorksheet("Carpenter")!.rowCount).toBe(1);
  });

  it("leaves out complaints that are in process or resolved", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    await complain(1, "Plumbing", "New one");
    const b = await complain(1, "Plumbing", "In process one");
    const c = await complain(1, "Plumbing", "Resolved one");
    await caretaker.updateStatus(c1, b.id, "InProgress");
    await caretaker.updateStatus(c1, c.id, "Resolved");

    const ws = (await workbook(await caretaker.export(c1, "xlsx"))).getWorksheet("Plumbing")!;
    expect(ws.rowCount).toBe(2);
    expect((ws.getRow(2).values as unknown[])[6]).toBe("New one");
  });

  it("a complaint that moves to in process disappears from the next Excel", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const a = await complain(1, "Electrical");
    expect((await workbook(await caretaker.export(c1, "xlsx"))).getWorksheet("Electrical")!.rowCount).toBe(2);
    await caretaker.updateStatus(c1, a.id, "InProgress");
    expect((await workbook(await caretaker.export(c1, "xlsx"))).getWorksheet("Electrical")!.rowCount).toBe(1);
  });

  it("a category page's Excel has only that category (one sheet) and says so in the file name", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    await complain(1, "Plumbing", "Tap leaks");
    await complain(1, "Electrical", "Fan broken");

    const f = await caretaker.export(c1, "xlsx", "Electrical");
    expect(f.filename).toMatch(/^complaints-satluj-electrical-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = await workbook(f);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Electrical"]);
    expect(wb.getWorksheet("Electrical")!.rowCount).toBe(2);
  });

  it("never includes another hostel's complaints", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj"); await student(2, "beas");
    await complain(1, "Plumbing", "Mine");
    await complain(2, "Plumbing", "Other hostel");
    const ws = (await workbook(await caretaker.export(c1, "xlsx"))).getWorksheet("Plumbing")!;
    expect(ws.rowCount).toBe(2);
    expect((ws.getRow(2).values as unknown[])[6]).toBe("Mine");
  });

  it("text that looks like a formula is stored as plain text", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    await complain(1, "Plumbing", '=HYPERLINK("http://x")');
    const cell = (await workbook(await caretaker.export(c1, "xlsx"))).getWorksheet("Plumbing")!.getRow(2).getCell(6);
    expect(typeof cell.value).toBe("string");
    expect(cell.value).toBe('=HYPERLINK("http://x")');
  });

  it("only caretakers may download it", async () => {
    for (const u of [await asUser("w1@iitrpr.ac.in"), await asUser(email(9))]) {
      await expect(caretaker.export(u, "xlsx")).rejects.toThrow(/access/i);
    }
  });
});

describe("Caretaker complaints: CSV and PDF with categories and the 2-day rule", () => {
  beforeEach(() => {
    resetMemoryStore();
    students.clear();
  });

  it("CSV of a category has only that category", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    await complain(1, "Plumbing", "Tap leaks");
    await complain(1, "Electrical", "Fan broken");
    const body = text(await caretaker.export(c1, "csv", "Plumbing"));
    expect(body).toContain("Tap leaks");
    expect(body).not.toContain("Fan broken");
  });

  it("CSV and PDF leave out complaints resolved more than 2 days ago", async () => {
    const c1 = await asUser("c1@iitrpr.ac.in");
    await student(1, "satluj");
    const old = await complain(1, "Plumbing", "Long gone");
    await complain(1, "Electrical", "Still here");
    await caretaker.updateStatus(c1, old.id, "Resolved");
    row(old.id).resolvedAt = ago(3);

    const csv = text(await caretaker.export(c1, "csv"));
    expect(csv).not.toContain("Long gone");
    expect(csv).toContain("Still here");

    const pdf = await caretaker.export(c1, "pdf");
    const pages = String.fromCharCode(...(pdf.body as Uint8Array)).match(/\/Type \/Page /g) ?? [];
    expect(pages).toHaveLength(1);
  });
});

describe("Caretaker complaints: download request check", () => {
  const parse = (v: unknown) => complaintExportQuerySchema.safeParse(v);

  it("accepts csv, pdf and xlsx, with or without a known category", () => {
    for (const format of ["csv", "pdf", "xlsx"]) expect(parse({ format }).success).toBe(true);
    expect(parse({ format: "xlsx", category: COMPLAINT_CATEGORIES[0] }).success).toBe(true);
  });

  it("rejects an unknown format or category", () => {
    expect(parse({ format: "docx" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ format: "xlsx", category: "Made up" }).success).toBe(false);
  });
});
