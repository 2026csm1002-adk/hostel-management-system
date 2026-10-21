import { memory, type CleaningBookingRow } from "@/server/db/memory-store";

// TEMPORARY: in-memory. DB SWAP: Drizzle query on `cleaning_booking`.
// Supervisor-only reads, kept apart from the student's cleaning-booking.repo.ts.

export const supervisorBoardRepo = {
  /**
   * Every booking from `fromDate` to `toDate` (inclusive), for one hostel or, without hostelId,
   * for all hostels. Each row carries its slotGroup (wing, or "ALL" for T6).
   * DB SWAP: WHERE booking_date BETWEEN ... [AND hostel_id = ...].
   */
  async listForRange(fromDate: string, toDate: string, hostelId?: string): Promise<CleaningBookingRow[]> {
    return memory.cleaningBookings
      .filter(
        (b) =>
          b.bookingDate >= fromDate &&
          b.bookingDate <= toDate &&
          (hostelId === undefined || b.hostelId === hostelId),
      )
      .map((b) => ({ ...b }));
  },
};
