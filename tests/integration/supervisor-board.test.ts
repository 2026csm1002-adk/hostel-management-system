import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { BOOKING_MAX_DAYS_AHEAD } from "@/lib/constants";
import { addDays, todayISO } from "@/lib/dates";
import { memory, resetMemoryStore, type CleaningBookingRow } from "@/server/db/memory-store";
import { studentRepo } from "@/server/repositories/student.repo";
import { supervisorService } from "@/server/services/supervisor.service";

// These tests put bookings straight into the store, so they do not depend on the student booking code.
// Bookings made before the student update have no slotGroup; both kinds are tested.

const supervisor = { email: "sup@iitrpr.ac.in", role: "Supervisor" as const, userId: "s1", hostelId: null };
const caretaker = { email: "c@iitrpr.ac.in", role: "Caretaker" as const, userId: "c1", hostelId: "satluj" };
const day2 = () => addDays(todayISO(), 2);

let counter = 0;
type Opts = { hostelId: string; wing: string; room: string; floor: number; slot?: string; withGroup: boolean };

/** One student of `wing` with one confirmed booking on day+2. */
async function book(o: Opts) {
  const n = ++counter;
  const studentId = `2026CSM${1000 + n}`;
  await studentRepo.upsert({
    studentId, fullName: `Student ${n}`, googleEmail: `${studentId.toLowerCase()}@iitrpr.ac.in`,
    hostelId: o.hostelId, wing: o.wing, roomNo: o.room, course: "MTech", batch: "2026", mobileNo: "9876543210",
  } as never);
  const seat = memory.cleaningBookings.filter(
    (b) => b.hostelId === o.hostelId && b.floor === o.floor && b.bookingDate === day2() && b.slotStart === (o.slot ?? "09:00") &&
      (!o.withGroup || (b as { slotGroup?: string }).slotGroup === (o.hostelId === "t6" ? "ALL" : o.wing)),
  ).length + 1;
  memory.cleaningBookings.push({
    bookingId: `b${n}`, studentId, hostelId: o.hostelId, floor: o.floor, roomNo: o.room,
    bookingDate: day2(), slotStart: o.slot ?? "09:00", seat, status: "Confirmed",
    ...(o.withGroup ? { slotGroup: o.hostelId === "t6" ? "ALL" : o.wing } : {}),
  } as unknown as CleaningBookingRow);
}

async function workbook(f: { body: string | Uint8Array }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(f.body as unknown as ArrayBuffer);
  return wb;
}
const cells = (ws: ExcelJS.Worksheet) =>
  ws.getRows(1, ws.rowCount)!.map((r) => (r.values as unknown[]).slice(1).map(String).join("|"));

for (const withGroup of [false, true]) {
  describe(`Supervisor board and export, wing-wise (bookings ${withGroup ? "with" : "without"} a stored slotGroup)`, () => {
    beforeEach(resetMemoryStore);

    it("shows today + the booking window and ONE section per wing, each with its own rooms", async () => {
      await book({ hostelId: "satluj", wing: "SE", room: "105", floor: 0, withGroup });
      await book({ hostelId: "satluj", wing: "SE", room: "107", floor: 0, withGroup });
      await book({ hostelId: "satluj", wing: "SE", room: "108", floor: 0, withGroup });
      await book({ hostelId: "satluj", wing: "SE", room: "309", floor: 2, withGroup });
      await book({ hostelId: "satluj", wing: "SW", room: "205", floor: 1, withGroup });

      const board = await supervisorService.getBoard(supervisor, "satluj");
      expect(board.hostelName).toBe("Satluj");
      expect(board.dates).toHaveLength(BOOKING_MAX_DAYS_AHEAD + 1);
      expect(board.dates[0]).toBe(todayISO());
      expect(board.groups.map((g) => g.label)).toEqual(["Wing SE", "Wing SW"]);

      const [se, sw] = board.groups;
      expect(se.floors).toEqual([0, 1, 2, 3]);
      const seSlot = se.days[2].slots[0]; // day+2, 9:00
      expect(seSlot.cells[0].rooms).toEqual(["105", "107", "108"]);
      expect(seSlot.cells[2].rooms).toEqual(["309"]);
      expect(sw.days[2].slots[0].cells[1].rooms).toEqual(["205"]); // SW is not mixed with SE
      expect(board.stats).toMatchObject({ booked: 5, fullSlots: 1, totalSlots: 2 * board.dates.length * 4 * 6 });
    });

    it("each wing has its own number of floors (Brahmaputra 6 / 5, T6 2, others 4)", async () => {
      const bh = await supervisorService.getBoard(supervisor, "brahmaputra");
      expect(bh.groups.map((g) => [g.slotGroup, g.floors.length])).toEqual([["BHN", 6], ["BHS", 5]]);
      const t6 = await supervisorService.getBoard(supervisor, "t6");
      expect(t6.groups.map((g) => g.floors.length)).toEqual([2]);
      const raavi = await supervisorService.getBoard(supervisor, "raavi");
      expect(raavi.groups.map((g) => [g.slotGroup, g.floors.length])).toEqual([["RE", 4], ["RC", 4], ["RW", 4]]);
    });

    it("T6 is one section for all wings and shows each room with its wing", async () => {
      await book({ hostelId: "t6", wing: "C", room: "105", floor: 0, slot: "10:00", withGroup });
      await book({ hostelId: "t6", wing: "D", room: "106", floor: 0, slot: "10:00", withGroup });
      const board = await supervisorService.getBoard(supervisor, "t6");
      expect(board.groups).toHaveLength(1);
      expect(board.groups[0].days[2].slots[1].cells[0].rooms).toEqual(["105 (C)", "106 (D)"]);
    });

    it("each hostel has its own board", async () => {
      await book({ hostelId: "satluj", wing: "SE", room: "105", floor: 0, withGroup });
      await book({ hostelId: "beas", wing: "BE", room: "105", floor: 0, withGroup });
      expect((await supervisorService.getBoard(supervisor, "beas")).stats.booked).toBe(1);
    });

    it("only the supervisor may use it; unknown hostel is rejected", async () => {
      await expect(supervisorService.getBoard(caretaker, "satluj")).rejects.toThrow(/access/i);
      await expect(supervisorService.exportSchedule(caretaker, "xlsx")).rejects.toThrow(/access/i);
      await expect(supervisorService.getBoard(supervisor, "nowhere")).rejects.toThrow(/hostel/i);
    });

    it("Excel export: one sheet per wing in one workbook; T6 one sheet; empty wings keep a sheet", async () => {
      await book({ hostelId: "satluj", wing: "SE", room: "105", floor: 0, withGroup });
      await book({ hostelId: "satluj", wing: "SW", room: "207", floor: 1, slot: "11:00", withGroup });
      await book({ hostelId: "t6", wing: "E", room: "105", floor: 0, slot: "11:00", withGroup });

      const one = await supervisorService.exportSchedule(supervisor, "xlsx", "satluj");
      expect(one.filename).toBe(`cleaning-schedule-satluj-${todayISO()}.xlsx`);
      const wb = await workbook(one);
      expect(wb.worksheets.map((w) => w.name)).toEqual(["Satluj SE", "Satluj SW"]);
      expect(cells(wb.getWorksheet("Satluj SE")!)).toEqual([
        "Date|Hostel|Wing|Floor|Slot|Room Number",
        `${day2()}|Satluj|SE|Ground floor|9:00–10:00 AM|105`,
      ]);
      expect(cells(wb.getWorksheet("Satluj SW")!).join("\n")).toContain("207");
      expect(cells(wb.getWorksheet("Satluj SW")!).join("\n")).not.toContain("105");

      const all = await workbook(await supervisorService.exportSchedule(supervisor, "xlsx"));
      const names = all.worksheets.map((w) => w.name);
      expect(names).toEqual(expect.arrayContaining(["Beas BE", "Brahmaputra BHN", "T6 (all wings)"]));
      expect(names.filter((n) => n.startsWith("T6"))).toHaveLength(1);
      expect(cells(all.getWorksheet("T6 (all wings)")!)[1]).toContain("|E|"); // the room's wing is shown
    });

    it("PDF export is a table (Wing | Floor | Slot | Rooms to clean), one page per date", async () => {
      await book({ hostelId: "satluj", wing: "SE", room: "105", floor: 0, withGroup });
      const pdf = await supervisorService.exportSchedule(supervisor, "pdf", "satluj");
      expect(pdf.contentType).toBe("application/pdf");
      const raw = Buffer.from(pdf.body as Uint8Array).toString("latin1");
      expect(raw.startsWith("%PDF-")).toBe(true);
      expect(raw).toContain("Rooms to clean");
      expect(raw).toContain("Ground floor");
      expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBe(BOOKING_MAX_DAYS_AHEAD + 1); // one page per date
    });
  });
}
