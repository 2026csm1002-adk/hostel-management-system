import { db } from "@/server/db/client";
import { complaint, student } from "@/server/db/schema";
import type { ComplaintRow } from "@/server/repositories/complaint.repo";
import type { StudentRow } from "@/server/repositories/student.repo";
import { and, desc, eq } from "drizzle-orm";

// The complaint queries a caretaker needs, straight from the database
// (complaints joined to the students who live in the caretaker's hostel).

export type ComplaintWithStudent = { complaint: ComplaintRow; student: StudentRow };

export const caretakerComplaintRepo = {
  /** Complaints of the students living in one hostel (every wing), newest first, optionally one category. */
  async listByHostel(hostelId: string, category?: string): Promise<ComplaintWithStudent[]> {
    return db
      .select({ complaint, student })
      .from(complaint)
      .innerJoin(student, eq(complaint.studentId, student.studentId))
      .where(category ? and(eq(student.hostelId, hostelId), eq(complaint.category, category)) : eq(student.hostelId, hostelId))
      .orderBy(desc(complaint.createdAt));
  },

  async updateStatus(complaintId: string, status: string, resolvedAt: string | null): Promise<ComplaintRow | undefined> {
    const [updated] = await db
      .update(complaint)
      .set({ status, resolvedAt })
      .where(eq(complaint.complaintId, complaintId))
      .returning();
    return updated;
  },
};
