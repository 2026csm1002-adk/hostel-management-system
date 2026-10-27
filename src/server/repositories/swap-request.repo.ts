import { db } from "@/server/db/client";
import { student, swapRequest } from "@/server/db/schema";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";

export type SwapRequestRow = typeof swapRequest.$inferSelect;
export type StudentRow = typeof student.$inferSelect;
export type SwapWithStudent = { swap: SwapRequestRow; student: StudentRow };

export const swapRequestRepo = {
  async insert(row: typeof swapRequest.$inferInsert): Promise<SwapRequestRow> {
    const [inserted] = await db.insert(swapRequest).values(row).returning();
    return inserted;
  },

  async findById(swapId: string): Promise<SwapRequestRow | undefined> {
    const [row] = await db
      .select()
      .from(swapRequest)
      .where(eq(swapRequest.swapId, swapId))
      .limit(1);
    return row;
  },

  async listByStudent(studentId: string): Promise<SwapRequestRow[]> {
    return db
      .select()
      .from(swapRequest)
      .where(eq(swapRequest.studentId, studentId))
      .orderBy(desc(swapRequest.createdAt));
  },

  async update(
    swapId: string,
    patch: Partial<Omit<SwapRequestRow, "swapId" | "studentId">>,
  ): Promise<SwapRequestRow | undefined> {
    const [updated] = await db
      .update(swapRequest)
      .set(patch)
      .where(eq(swapRequest.swapId, swapId))
      .returning();
    return updated;
  },

  async clearMessagesOfClosed(): Promise<void> {
    await db
      .update(swapRequest)
      .set({ wardenComment: null, caretakerComment: null })
      .where(
        and(
          eq(swapRequest.status, "RoomAssigned"),
          or(isNotNull(swapRequest.wardenComment), isNotNull(swapRequest.caretakerComment)),
        ),
      );

    await db
      .update(swapRequest)
      .set({ caretakerComment: null })
      .where(
        and(
          eq(swapRequest.status, "Rejected"),
          isNotNull(swapRequest.caretakerComment),
        ),
      );
  },

  async listByWarden(wardenId: string): Promise<SwapWithStudent[]> {
    return db
      .select({
        swap: swapRequest,
        student,
      })
      .from(swapRequest)
      .innerJoin(student, eq(swapRequest.studentId, student.studentId))
      .where(eq(swapRequest.wardenId, wardenId))
      .orderBy(desc(swapRequest.createdAt));
  },

  async countsByBatchAndCourse(
    hostelId: string,
  ): Promise<{ byBatch: Map<string, number>; byCourse: Map<string, number> }> {
    const rows = await db
      .select({
        batch: student.batch,
        course: student.course,
      })
      .from(swapRequest)
      .innerJoin(student, eq(swapRequest.studentId, student.studentId))
      .where(eq(student.hostelId, hostelId));

    const byBatch = new Map<string, number>();
    const byCourse = new Map<string, number>();
    for (const r of rows) {
      byBatch.set(r.batch, (byBatch.get(r.batch) ?? 0) + 1);
      byCourse.set(r.course, (byCourse.get(r.course) ?? 0) + 1);
    }
    return { byBatch, byCourse };
  },
};