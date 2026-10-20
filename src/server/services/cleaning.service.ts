import {
  BOOKING_MAX_DAYS_AHEAD,
  DEFAULT_FLOOR_COUNT,
  HOSTELS,
  MAX_ROOMS_PER_SLOT,
  SLOT_STARTS,
} from "@/lib/constants";
import { addDays, isValidISODate, isWithinBookingWindow, slotLabel, todayISO } from "@/lib/dates";
import { floorFromRoom, floorLabel } from "@/lib/room";
import type { BookingInput } from "@/lib/validators/cleaning.schema";
import type { CleaningBookingRow } from "@/server/db/memory-store";
import { ConflictError, ValidationError } from "@/server/errors";
import { requireRole } from "@/server/services/auth.service";
import { exportService, type ExportFile, type ScheduleRow } from "@/server/services/export.service";
import { cleaningBookingRepo } from "@/server/repositories/cleaning-booking.repo";
import { profileService } from "@/server/services/profile.service";
import type { BoardDTO, CleaningBookingDTO, SessionUser, SlotAvailability } from "@/types";

function assertBookable(date: string) {
  if (!isValidISODate(date) || !isWithinBookingWindow(date)) {
    throw new ValidationError("Cleaning can be booked only 2 to 4 days ahead.");
  }
}

/** The floor of the student's room. Only fails for an old profile whose room no longer fits its hostel. */
function studentFloor(student: { roomNo: string; hostelId: string }): number {
  const floor = floorFromRoom(student.roomNo, student.hostelId);
  if (floor === null) throw new ValidationError("Please correct your room number in your profile.");
  return floor;
}

function toDTO(row: CleaningBookingRow): CleaningBookingDTO {
  return {
    id: row.bookingId,
    date: row.bookingDate,
    slotStart: row.slotStart,
    label: slotLabel(row.slotStart),
    floor: row.floor,
    floorLabel: floorLabel(row.floor),
    roomNo: row.roomNo,
    seat: row.seat,
    status: row.status as CleaningBookingDTO["status"],
  };
}

export const cleaningService = {
  /** The six slots of the student's own floor, with how many of the 3 seats are taken. */
  async getAvailability(email: string, date: string): Promise<SlotAvailability[]> {
    const student = await profileService.requireProfile(email);
    assertBookable(date);
    const floor = studentFloor(student);
    const rows = await cleaningBookingRepo.listForDay(student.hostelId, floor, date);

    return SLOT_STARTS.map((slotStart) => {
      const inSlot = rows.filter((r) => r.slotStart === slotStart);
      return {
        slotStart,
        label: slotLabel(slotStart),
        filled: inSlot.length,
        capacity: MAX_ROOMS_PER_SLOT,
        status: inSlot.length >= MAX_ROOMS_PER_SLOT ? "Full" : "Available",
        bookedByMe: inSlot.some((r) => r.roomNo === student.roomNo),
      };
    });
  },

  async bookSlot(email: string, input: BookingInput): Promise<CleaningBookingDTO> {
    const student = await profileService.requireProfile(email);
    assertBookable(input.date);
    const floor = studentFloor(student);

    const duplicate = await cleaningBookingRepo.findByRoomAndSlot(
      student.hostelId,
      student.roomNo,
      input.date,
      input.slotStart,
    );
    if (duplicate) throw new ConflictError("Your room already has a booking in this slot.");

    // Never "count, then insert": the repository takes the seat in one step.
    const row = await cleaningBookingRepo.insertWithLowestFreeSeat({
      studentId: student.studentId,
      hostelId: student.hostelId,
      floor,
      roomNo: student.roomNo,
      bookingDate: input.date,
      slotStart: input.slotStart,
    });
    if (!row) throw new ConflictError("This slot is full. Please pick another one.");
    return toDTO(row);
  },

  /** My bookings, soonest first. Empty (not an error) while there is no profile. */
  async listMine(email: string): Promise<CleaningBookingDTO[]> {
    const profile = await profileService.getProfile(email);
    if (!profile) return [];
    const rows = await cleaningBookingRepo.listByStudent(profile.studentId);
    return rows
      .sort((a, b) => (a.bookingDate + a.slotStart).localeCompare(b.bookingDate + b.slotStart))
      .map(toDTO);
  },

  // ---------------------------------------------------------------------------
  // Supervisor
  // ---------------------------------------------------------------------------

  /** Today .. today + 4 for one hostel: for every slot and floor, which rooms are booked. */
  async getBoard(user: SessionUser, hostelId: string): Promise<BoardDTO> {
    requireRole(user, ["Supervisor"]);
    const hostel = HOSTELS.find((h) => h.id === hostelId);
    if (!hostel) throw new ValidationError("Choose a valid hostel.");

    const today = todayISO();
    const dates = windowDates(today);
    const rows = await cleaningBookingRepo.listForRange(dates[0], dates[dates.length - 1], hostelId);

    const topFloor = Math.max(DEFAULT_FLOOR_COUNT - 1, ...rows.map((r) => r.floor));
    const floors = Array.from({ length: topFloor + 1 }, (_, f) => f);

    let fullSlots = 0;
    const days = dates.map((date) => ({
      date,
      slots: SLOT_STARTS.map((slotStart) => ({
        slotStart,
        label: slotLabel(slotStart),
        cells: floors.map((floor) => {
          const rooms = rows
            .filter((r) => r.bookingDate === date && r.slotStart === slotStart && r.floor === floor)
            .sort((a, b) => a.seat - b.seat)
            .map((r) => r.roomNo);
          if (rooms.length >= MAX_ROOMS_PER_SLOT) fullSlots++;
          return { floor, rooms };
        }),
      })),
    }));

    return {
      hostelId,
      hostelName: hostel.name,
      today,
      floors,
      days,
      stats: {
        booked: rows.length,
        fullSlots,
        totalSlots: dates.length * floors.length * SLOT_STARTS.length,
      },
    };
  },

  /** The schedule as a CSV or PDF file. No hostelId = every hostel. */
  async exportSchedule(user: SessionUser, format: "csv" | "pdf", hostelId?: string): Promise<ExportFile> {
    requireRole(user, ["Supervisor"]);
    if (hostelId && !HOSTELS.some((h) => h.id === hostelId)) throw new ValidationError("Choose a valid hostel.");

    const today = todayISO();
    const dates = windowDates(today);
    const bookings = await cleaningBookingRepo.listForRange(dates[0], dates[dates.length - 1], hostelId);

    const rows: ScheduleRow[] = bookings.map((b) => ({
      date: b.bookingDate,
      hostelName: HOSTELS.find((h) => h.id === b.hostelId)?.name ?? b.hostelId,
      floor: b.floor,
      floorLabel: floorLabel(b.floor),
      slotStart: b.slotStart,
      slotLabel: slotLabel(b.slotStart),
      roomNo: b.roomNo,
    }));

    const scope = hostelId ?? "all-hostels";
    const filename = `cleaning-schedule-${scope}-${today}.${format}`;
    const hostelName = hostelId ? HOSTELS.find((h) => h.id === hostelId)!.name : "All hostels";
    return format === "csv"
      ? exportService.scheduleCsv(rows, filename)
      : exportService.schedulePdf(rows, dates, `Cleaning schedule (${hostelName})`, filename);
  },
};

/** The days the supervisor sees: today and the next 4 (the furthest day a student can book). */
function windowDates(today: string): string[] {
  return Array.from({ length: BOOKING_MAX_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
}
