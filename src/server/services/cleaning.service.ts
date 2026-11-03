import {
  BOOKING_MAX_DAYS_AHEAD,
  BOOKING_MIN_DAYS_AHEAD,
  MAX_ROOMS_PER_SLOT,
  SLOT_STARTS,
} from "@/lib/constants";
import {
  formatDateLabel,
  isValidISODate,
  isWithinBookingWindow,
  slotLabel,
} from "@/lib/dates";
import { slotGroupOf } from "@/lib/hostels";
import { floorFromRoom, floorLabel } from "@/lib/room";
import type { BookingInput } from "@/lib/validators/cleaning.schema";
import type { CleaningBookingRow } from "@/server/db/memory-store";
import { ConflictError, ValidationError } from "@/server/errors";
import { cleaningBookingRepo } from "@/server/repositories/cleaning-booking.repo";
import { profileService } from "@/server/services/profile.service";
import type {
  CleaningBookingDTO,
  SlotAvailability,
} from "@/types";

const WINDOW_MESSAGE =
  BOOKING_MIN_DAYS_AHEAD === 1
    ? `Cleaning can be booked only for the next ${BOOKING_MAX_DAYS_AHEAD} days, starting tomorrow.`
    : `Cleaning can be booked only ${BOOKING_MIN_DAYS_AHEAD} to ${BOOKING_MAX_DAYS_AHEAD} days ahead.`;

function alreadyBookedToday(date: string, slotStart?: string): ConflictError {
  const where = slotStart ? ` (${slotLabel(slotStart)})` : "";

  return new ConflictError(
    `You have already booked a cleaning slot on ${formatDateLabel(date)}${where}. Only one slot can be booked per day.`,
  );
}

function assertBookable(date: string) {
  if (!isValidISODate(date) || !isWithinBookingWindow(date)) {
    throw new ValidationError(WINDOW_MESSAGE);
  }
}

/** The floor of the student's room. Only fails for an old profile whose room no longer fits its hostel. */
function studentFloor(student: {
  roomNo: string;
  hostelId: string;
}): number {
  const floor = floorFromRoom(student.roomNo, student.hostelId);

  if (floor === null) {
    throw new ValidationError(
      "Please correct your room number in your profile.",
    );
  }

  return floor;
}

function toDTO(
  row: CleaningBookingRow,
  wing: string,
): CleaningBookingDTO {
  return {
    id: row.bookingId,
    date: row.bookingDate,
    slotStart: row.slotStart,
    label: slotLabel(row.slotStart),
    floor: row.floor,
    floorLabel: floorLabel(row.floor),
    wing,
    roomNo: row.roomNo,
    seat: row.seat,
    status: row.status as CleaningBookingDTO["status"],
  };
}

export const cleaningService = {
  /**
   * The six slots of the student's own floor in their own wing (T6: all wings share), with how many
   * of the 3 seats are taken.
   */
  async getAvailability(
    email: string,
    date: string,
  ): Promise<SlotAvailability[]> {
    const student = await profileService.requireProfile(email);

    assertBookable(date);

    const floor = studentFloor(student);

    // A student may hold only one slot per day, so once they have one the other slots are closed to them.
    const dayBooked =
      (await cleaningBookingRepo.findByStudentAndDate(
        student.studentId,
        date,
      )) !== undefined;

    const rows = await cleaningBookingRepo.listForDay(
      student.hostelId,
      slotGroupOf(student.hostelId, student.wing),
      floor,
      date,
    );

    return SLOT_STARTS.map((slotStart) => {
      const inSlot = rows.filter(
        (r) => r.slotStart === slotStart,
      );

      return {
        slotStart,
        label: slotLabel(slotStart),
        filled: inSlot.length,
        capacity: MAX_ROOMS_PER_SLOT,
        status:
          inSlot.length >= MAX_ROOMS_PER_SLOT
            ? "Full"
            : "Available",
        bookedByMe: inSlot.some(
          (r) => r.roomNo === student.roomNo,
        ),
        dayBooked,
      };
    });
  },

  async bookSlot(
    email: string,
    input: BookingInput,
  ): Promise<CleaningBookingDTO> {
    const student = await profileService.requireProfile(email);

    assertBookable(input.date);

    const floor = studentFloor(student);

    const duplicate = await cleaningBookingRepo.findByRoomAndSlot(
      student.hostelId,
      student.roomNo,
      input.date,
      input.slotStart,
    );

    if (duplicate) {
      throw new ConflictError(
        "Your room already has a booking in this slot.",
      );
    }

    // One cleaning slot per person per day (checked again inside the repository, so two quick clicks cannot both succeed).
    const mine = await cleaningBookingRepo.findByStudentAndDate(
      student.studentId,
      input.date,
    );

    if (mine) {
      throw alreadyBookedToday(mine.bookingDate, mine.slotStart);
    }

    // Never "count, then insert": the repository takes the seat in one step.
    const result = await cleaningBookingRepo.insertWithLowestFreeSeat({
      studentId: student.studentId,
      hostelId: student.hostelId,
      slotGroup: slotGroupOf(student.hostelId, student.wing),
      wing: student.wing.trim().toUpperCase(),
      floor,
      roomNo: student.roomNo,
      bookingDate: input.date,
      slotStart: input.slotStart,
    });

    if (!result.ok) {
      if (result.reason === "student-has-booking") {
        throw alreadyBookedToday(input.date);
      }

      throw new ConflictError(
        "This slot is full. Please pick another one.",
      );
    }

    return toDTO(result.row, student.wing);
  },

  /** My bookings, soonest first. Empty (not an error) while there is no profile. */
  async listMine(email: string): Promise<CleaningBookingDTO[]> {
    const profile = await profileService.getProfile(email);

    if (!profile) return [];

    const rows = await cleaningBookingRepo.listByStudent(
      profile.studentId,
    );

    return rows
      .sort((a, b) =>
        (a.bookingDate + a.slotStart).localeCompare(
          b.bookingDate + b.slotStart,
        ),
      )
      .map((row) => toDTO(row, profile.wing));
  },
};