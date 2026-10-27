import { db } from "@/server/db/client";
import { cleaningBooking } from "@/server/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";

export type CleaningBookingRow = typeof cleaningBooking.$inferSelect;

export const supervisorBoardRepo = {
  async listForRange(fromDate: string, toDate: string, hostelId?: string): Promise<CleaningBookingRow[]> {
    const conditions = [
      gte(cleaningBooking.bookingDate, fromDate),
      lte(cleaningBooking.bookingDate, toDate),
    ];
    if (hostelId !== undefined) {
      conditions.push(eq(cleaningBooking.hostelId, hostelId));
    }

    return db
      .select()
      .from(cleaningBooking)
      .where(and(...conditions));
  },
};