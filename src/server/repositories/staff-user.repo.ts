import { db } from "@/server/db/client";
import { staffUser } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export type StaffRow = typeof staffUser.$inferSelect;

export const staffUserRepo = {
  async findById(staffId: string): Promise<StaffRow | undefined> {
    const [row] = await db
      .select()
      .from(staffUser)
      .where(eq(staffUser.staffId, staffId))
      .limit(1);
    return row;
  },

  async findByEmail(email: string): Promise<StaffRow | undefined> {
    const [row] = await db
      .select()
      .from(staffUser)
      .where(eq(staffUser.googleEmail, email.toLowerCase().trim()))
      .limit(1);
    return row;
  },

  async findWardenOfHostel(hostelId: string): Promise<StaffRow | undefined> {
    const [row] = await db
      .select()
      .from(staffUser)
      .where(and(eq(staffUser.role, "Warden"), eq(staffUser.hostelId, hostelId)))
      .limit(1);
    return row;
  },
};