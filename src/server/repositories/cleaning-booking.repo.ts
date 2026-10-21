import { randomUUID } from "node:crypto";
import { MAX_ROOMS_PER_SLOT } from "@/lib/constants";
import { memory, type CleaningBookingRow } from "@/server/db/memory-store";

// TEMPORARY: in-memory. DB SWAP: Drizzle queries on `cleaning_booking`.

export type NewBooking = Omit<CleaningBookingRow, "bookingId" | "seat" | "status">;

/** Why a booking was not made: the slot is full, or the student already holds a slot that day. */
export type InsertResult =
  | { ok: true; row: CleaningBookingRow }
  | { ok: false; reason: "slot-full" | "student-has-booking" };

export const cleaningBookingRepo = {
  /**
   * All bookings of one floor of one slot group on one date (every slot).
   * The slot group is the wing (SE, SW, ...) or "ALL" for T6, see slotGroupOf in hostels.ts.
   */
  async listForDay(hostelId: string, slotGroup: string, floor: number, date: string): Promise<CleaningBookingRow[]> {
    return memory.cleaningBookings
      .filter(
        (b) =>
          b.hostelId === hostelId && b.slotGroup === slotGroup && b.floor === floor && b.bookingDate === date,
      )
      .map((b) => ({ ...b }));
  },

  /** A booking for this exact room in this slot, if any. */
  async findByRoomAndSlot(
    hostelId: string,
    roomNo: string,
    date: string,
    slotStart: string,
  ): Promise<CleaningBookingRow | undefined> {
    const row = memory.cleaningBookings.find(
      (b) =>
        b.hostelId === hostelId &&
        b.roomNo === roomNo &&
        b.bookingDate === date &&
        b.slotStart === slotStart,
    );
    return row && { ...row };
  },

  /** The booking this student already holds on this date (a student may hold only one per day). */
  async findByStudentAndDate(studentId: string, date: string): Promise<CleaningBookingRow | undefined> {
    const row = memory.cleaningBookings.find((b) => b.studentId === studentId && b.bookingDate === date);
    return row && { ...row };
  },

  /**
   * One booking per student per day, then takes the lowest free seat (1..3) and inserts.
   * Fails with "student-has-booking" or "slot-full".
   * The in-memory version has no `await` between the check and the push, so two
   * requests can never take the same seat.
   * DB SWAP: do this inside a transaction and rely on
   * UNIQUE(hostel_id, slot_group, floor, booking_date, slot_start, seat); if the insert hits
   * that rule, try the next seat, and report "slot-full" when none is left. Also add
   * UNIQUE(student_id, booking_date): a hit on it means "student-has-booking".
   */
  async insertWithLowestFreeSeat(input: NewBooking): Promise<InsertResult> {
    if (memory.cleaningBookings.some((b) => b.studentId === input.studentId && b.bookingDate === input.bookingDate)) {
      return { ok: false, reason: "student-has-booking" };
    }
    const taken = new Set(
      memory.cleaningBookings
        .filter(
          (b) =>
            b.hostelId === input.hostelId &&
            b.slotGroup === input.slotGroup &&
            b.floor === input.floor &&
            b.bookingDate === input.bookingDate &&
            b.slotStart === input.slotStart,
        )
        .map((b) => b.seat),
    );
    let seat = 0;
    for (let s = 1; s <= MAX_ROOMS_PER_SLOT; s++) {
      if (!taken.has(s)) {
        seat = s;
        break;
      }
    }
    if (seat === 0) return { ok: false, reason: "slot-full" };

    const row: CleaningBookingRow = { ...input, bookingId: randomUUID(), seat, status: "Confirmed" };
    memory.cleaningBookings.push(row);
    return { ok: true, row: { ...row } };
  },

  async listByStudent(studentId: string): Promise<CleaningBookingRow[]> {
    return memory.cleaningBookings.filter((b) => b.studentId === studentId).map((b) => ({ ...b }));
  },
};
