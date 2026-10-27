import { db } from "@/server/db/client";
import { complaint } from "@/server/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";

export type ComplaintRow = typeof complaint.$inferSelect;
export type NewComplaintRow = typeof complaint.$inferInsert;

export const complaintRepo = {
  async insert(row: NewComplaintRow): Promise<ComplaintRow> {
    const [inserted] = await db.insert(complaint).values(row).returning();
    return inserted;
  },

  async findById(complaintId: string): Promise<ComplaintRow | undefined> {
    const [row] = await db
      .select()
      .from(complaint)
      .where(eq(complaint.complaintId, complaintId))
      .limit(1);
    return row;
  },

  /** Newest first. */
  async listByStudent(studentId: string): Promise<ComplaintRow[]> {
    return db
      .select()
      .from(complaint)
      .where(eq(complaint.studentId, studentId))
      .orderBy(desc(complaint.createdAt));
  },

  async hasBeenReregistered(complaintId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: complaint.complaintId })
      .from(complaint)
      .where(eq(complaint.reregisteredFrom, complaintId))
      .limit(1);
    return !!row;
  },

  /**
   * Sets the status to Resolved (only when it is not resolved yet) and returns the updated row.
   */
  async markResolved(complaintId: string, resolvedAt: string): Promise<ComplaintRow | undefined> {
    const [updated] = await db
      .update(complaint)
      .set({ status: "Resolved", resolvedAt })
      .where(and(eq(complaint.complaintId, complaintId), ne(complaint.status, "Resolved")))
      .returning();
    return updated;
  },
};