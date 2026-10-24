import { memory, type ComplaintRow, type StudentRow } from "@/server/db/memory-store";
import { studentRepo } from "@/server/repositories/student.repo";

// The complaint queries a caretaker needs. Students are looked up through studentRepo, so this works
// whether the students are in the database or in memory.
// TEMPORARY: the complaints themselves are in the in-memory store. DB SWAP: Drizzle queries on `complaint`.

export type ComplaintWithStudent = { complaint: ComplaintRow; student: StudentRow };

export const caretakerComplaintRepo = {
  /**
   * Complaints of the students living in one hostel (every wing), newest first, optionally one category.
   * DB SWAP: join complaint -> student on student_id, where student.hostel_id = ? (and category = ?),
   *          order by created_at desc.
   */
  async listByHostel(hostelId: string, category?: string): Promise<ComplaintWithStudent[]> {
    const out: ComplaintWithStudent[] = [];
    for (const c of memory.complaints) {
      if (category && c.category !== category) continue;
      const student = await studentRepo.findById(c.studentId);
      if (student && student.hostelId === hostelId) out.push({ complaint: { ...c }, student });
    }
    return out.sort((a, b) => b.complaint.createdAt.localeCompare(a.complaint.createdAt));
  },

  /** DB SWAP: update(complaint).set({ status, resolvedAt }).where(eq(complaintId, id)).returning() */
  async updateStatus(complaintId: string, status: string, resolvedAt: string | null): Promise<ComplaintRow | undefined> {
    const row = memory.complaints.find((c) => c.complaintId === complaintId);
    if (!row) return undefined;
    row.status = status;
    row.resolvedAt = resolvedAt;
    return { ...row };
  },
};
