import { db } from "@/server/db/client";
import { student } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const mobileRepo = {
  /** The saved 10-digit number of a student, or null when there is none. */
  async get(studentId: string): Promise<string | null> {
    const [row] = await db
      .select({ mobileNo: student.mobileNo })
      .from(student)
      .where(eq(student.studentId, studentId))
      .limit(1);
    return row?.mobileNo ?? null;
  },

  async set(studentId: string, mobileNo: string): Promise<void> {
    await db
      .update(student)
      .set({ mobileNo })
      .where(eq(student.studentId, studentId));
  },
};