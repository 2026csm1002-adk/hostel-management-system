import { db } from "@/server/db/client";
import { student } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export type StudentRow = typeof student.$inferSelect;
export type NewStudentRow = typeof student.$inferInsert;

export const studentRepo = {
  async findById(studentId: string): Promise<StudentRow | undefined> {
    const [row] = await db
      .select()
      .from(student)
      .where(eq(student.studentId, studentId))
      .limit(1);

    return row;
  },

  async findByEmail(email: string): Promise<StudentRow | undefined> {
    const [row] = await db
      .select()
      .from(student)
      .where(eq(student.googleEmail, email))
      .limit(1);

    return row;
  },

  async upsert(row: NewStudentRow): Promise<StudentRow> {
    const { studentId, ...updateFields } = row;

    const [upserted] = await db
      .insert(student)
      .values(row)
      .onConflictDoUpdate({
        target: student.studentId,
        set: updateFields,
      })
      .returning();

    return upserted;
  },
};