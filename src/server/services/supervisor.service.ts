import { BOOKING_MAX_DAYS_AHEAD, HOSTELS, MAX_ROOMS_PER_SLOT, SLOT_STARTS } from "@/lib/constants";
import { addDays, slotLabel, todayISO } from "@/lib/dates";
import { floorLabel } from "@/lib/room";
import { groupOfBooking, SHARED_SLOT_GROUP, slotGroupsOf } from "@/lib/supervisor-groups";
import type { CleaningBookingRow } from "@/server/db/memory-store";
import { ValidationError } from "@/server/errors";
import { studentRepo } from "@/server/repositories/student.repo";
import { supervisorBoardRepo } from "@/server/repositories/supervisor-board.repo";
import { requireRole } from "@/server/services/auth.service";
import {
  wingExportService,
  type ExportFile,
  type WingScheduleRow,
  type WingSheet,
} from "@/server/services/export.service";
import type { SessionUser } from "@/types";
import type { BoardDTO } from "@/types/supervisor-board";

/** The days the supervisor sees: today and the next 3 (the furthest day a student can book). */
function windowDates(today: string): string[] {
  return Array.from({ length: BOOKING_MAX_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
}

/** A booking row plus the group (wing) it belongs to and the wing of its student. */
type Placed = { row: CleaningBookingRow; group: string; wing: string };

/**
 * Works out the wing group of every booking. Older bookings carry no slot group, so the wing of the
 * student who booked is looked up. Works with or without a stored `slotGroup`.
 */
async function place(rows: CleaningBookingRow[]): Promise<Placed[]> {
  const wings = new Map<string, string>(); // studentId -> wing
  for (const id of new Set(rows.map((r) => r.studentId))) {
    const student = await studentRepo.findById(id);
    if (student?.wing) wings.set(id, student.wing);
  }
  return rows.map((row) => {
    // The wing saved on the booking wins; older bookings fall back to the student's current wing.
    const wing = row.wing?.trim().toUpperCase() || wings.get(row.studentId) || "";
    const stored = (row as { slotGroup?: string }).slotGroup;
    return { row, wing, group: groupOfBooking(row.hostelId, stored, wing) };
  });
}

/** In T6 all wings share one slot list, so a room is shown with its wing: "105 (C)". */
function roomLabel(p: Placed): string {
  return p.group === SHARED_SLOT_GROUP && p.wing ? `${p.row.roomNo} (${p.wing})` : p.row.roomNo;
}

export const supervisorService = {
  /**
   * Today .. today + 3 for one hostel. One section per wing (T6: one for all wings), because every
   * wing has its own slots. For every slot and floor: which rooms are booked.
   */
  async getBoard(user: SessionUser, hostelId: string): Promise<BoardDTO> {
    requireRole(user, ["Supervisor"]);
    const hostel = HOSTELS.find((h) => h.id === hostelId);
    if (!hostel) throw new ValidationError("Choose a valid hostel.");

    const today = todayISO();
    const dates = windowDates(today);
    const rows = await supervisorBoardRepo.listForRange(dates[0], dates[dates.length - 1], hostelId);
    const placed = await place(rows);

    let booked = 0;
    let fullSlots = 0;
    let totalSlots = 0;
    const groups = slotGroupsOf(hostelId).map((group) => {
      const mine = placed.filter((p) => p.group === group.slotGroup);
      booked += mine.length;
      // A floor above the wing's own floors still gets a column if a booking exists there.
      const topFloor = Math.max(group.floorCount - 1, ...mine.map((p) => p.row.floor));
      const floors = Array.from({ length: topFloor + 1 }, (_, f) => f);
      totalSlots += dates.length * floors.length * SLOT_STARTS.length;

      const days = dates.map((date) => ({
        date,
        slots: SLOT_STARTS.map((slotStart) => ({
          slotStart,
          label: slotLabel(slotStart),
          cells: floors.map((floor) => {
            const rooms = mine
              .filter((p) => p.row.bookingDate === date && p.row.slotStart === slotStart && p.row.floor === floor)
              .sort((a, b) => a.row.seat - b.row.seat)
              .map(roomLabel);
            if (rooms.length >= MAX_ROOMS_PER_SLOT) fullSlots++;
            return { floor, rooms };
          }),
        })),
      }));
      return { slotGroup: group.slotGroup, label: group.label, floors, days };
    });

    return { hostelId, hostelName: hostel.name, today, dates, groups, stats: { booked, fullSlots, totalSlots } };
  },

  /**
   * The schedule as an Excel file (one sheet per wing; T6 one sheet for all wings) or a PDF.
   * No hostelId = every hostel.
   */
  async exportSchedule(
    user: SessionUser,
    format: "xlsx" | "pdf",
    hostelId?: string,
    date?: string, // the day the supervisor selected; without it the whole window is exported
  ): Promise<ExportFile> {
    requireRole(user, ["Supervisor"]);
    if (hostelId && !HOSTELS.some((h) => h.id === hostelId)) throw new ValidationError("Choose a valid hostel.");

    const today = todayISO();
    const window = windowDates(today);
    if (date && !window.includes(date)) throw new ValidationError("Choose a day shown on the board.");
    const dates = date ? [date] : window; // only the selected day, or all days when none is given
    const bookings = await supervisorBoardRepo.listForRange(dates[0], dates[dates.length - 1], hostelId);
    const placed = await place(bookings);

    const sheets: WingSheet[] = [];
    for (const hostel of hostelId ? HOSTELS.filter((h) => h.id === hostelId) : HOSTELS) {
      for (const group of slotGroupsOf(hostel.id)) {
        const shared = group.slotGroup === SHARED_SLOT_GROUP;
        const rows: WingScheduleRow[] = placed
          .filter((p) => p.row.hostelId === hostel.id && p.group === group.slotGroup)
          .map((p) => ({
            date: p.row.bookingDate,
            hostelName: hostel.name,
            groupLabel: shared ? "All wings" : group.slotGroup,
            wing: shared ? p.wing : group.slotGroup,
            floor: p.row.floor,
            floorLabel: floorLabel(p.row.floor),
            slotStart: p.row.slotStart,
            slotLabel: slotLabel(p.row.slotStart),
            roomNo: p.row.roomNo,
            roomLabel: roomLabel(p),
          }));
        sheets.push({ name: `${hostel.name} ${shared ? "(all wings)" : group.slotGroup}`, rows });
      }
    }

    const scope = hostelId ?? "all-hostels";
    const filename = `cleaning-schedule-${scope}-${date ?? today}.${format}`;
    const hostelName = hostelId ? HOSTELS.find((h) => h.id === hostelId)!.name : "All hostels";
    return format === "xlsx"
      ? wingExportService.scheduleXlsx(sheets, filename)
      : wingExportService.schedulePdf(sheets.flatMap((s) => s.rows), dates, hostelName, filename, !hostelId);
  },
};
