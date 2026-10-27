import { randomUUID } from "node:crypto";
import { MAX_ROOMS_PER_SLOT } from "@/lib/constants";
import { db } from "@/server/db/client";
import { cleaningBooking, student } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export type CleaningBookingRow = typeof cleaningBooking.$inferSelect;
export type NewBooking = {
  studentId: string;
  hostelId: string;
  slotGroup?: string;
  floor: number;
  roomNo: string;
  bookingDate: string;
  slotStart: string;
};

export type InsertResult =
  | { ok: true; row: CleaningBookingRow }
  | { ok: false; reason: "slot-full" | "student-has-booking" };

export const cleaningBookingRepo = {
  /**
   * All bookings of one floor on one date (wing filtered via student wing for group isolation).
   */
  async listForDay(
    hostelId: string,
    slotGroup: string,
    floor: number,
    date: string,
  ): Promise<CleaningBookingRow[]> {
    const rows = await db
      .select({
        booking: cleaningBooking,
        wing: student.wing,
      })
      .from(cleaningBooking)
      .innerJoin(student, eq(cleaningBooking.studentId, student.studentId))
      .where(
        and(
          eq(cleaningBooking.hostelId, hostelId),
          eq(cleaningBooking.floor, floor),
          eq(cleaningBooking.bookingDate, date),
        ),
      );

    return rows
      .filter((r) => slotGroup === "ALL" || r.wing === slotGroup)
      .map((r) => r.booking);
  },

  async findByRoomAndSlot(
    hostelId: string,
    roomNo: string,
    date: string,
    slotStart: string,
  ): Promise<CleaningBookingRow | undefined> {
    const [row] = await db
      .select()
      .from(cleaningBooking)
      .where(
        and(
          eq(cleaningBooking.hostelId, hostelId),
          eq(cleaningBooking.roomNo, roomNo),
          eq(cleaningBooking.bookingDate, date),
          eq(cleaningBooking.slotStart, slotStart),
        ),
      )
      .limit(1);
    return row;
  },

  async findByStudentAndDate(studentId: string, date: string): Promise<CleaningBookingRow | undefined> {
    const [row] = await db
      .select()
      .from(cleaningBooking)
      .where(
        and(
          eq(cleaningBooking.studentId, studentId),
          eq(cleaningBooking.bookingDate, date),
        ),
      )
      .limit(1);
    return row;
  },

  async insertWithLowestFreeSeat(input: NewBooking): Promise<InsertResult> {
    // Check if student already booked for this date
    const existing = await this.findByStudentAndDate(input.studentId, input.bookingDate);
    if (existing) {
      return { ok: false, reason: "student-has-booking" };
    }

    const takenSeats = await db
      .select({ seat: cleaningBooking.seat })
      .from(cleaningBooking)
      .where(
        and(
          eq(cleaningBooking.hostelId, input.hostelId),
          eq(cleaningBooking.floor, input.floor),
          eq(cleaningBooking.bookingDate, input.bookingDate),
          eq(cleaningBooking.slotStart, input.slotStart),
        ),
      );

    const taken = new Set(takenSeats.map((b) => b.seat));
    let seat = 0;
    for (let s = 1; s <= MAX_ROOMS_PER_SLOT; s++) {
      if (!taken.has(s)) {
        seat = s;
        break;
      }
    }
    if (seat === 0) return { ok: false, reason: "slot-full" };

    try {
      const [row] = await db
        .insert(cleaningBooking)
        .values({
          bookingId: randomUUID(),
          studentId: input.studentId,
          hostelId: input.hostelId,
          floor: input.floor,
          roomNo: input.roomNo,
          bookingDate: input.bookingDate,
          slotStart: input.slotStart,
          seat,
          status: "Confirmed",
        })
        .returning();

      return { ok: true, row };
    } catch {
      return { ok: false, reason: "slot-full" };
    }
  },

  async listByStudent(studentId: string): Promise<CleaningBookingRow[]> {
    return db
      .select()
      .from(cleaningBooking)
      .where(eq(cleaningBooking.studentId, studentId));
  },
};