import { memory, type ComplaintRow } from "@/server/db/memory-store";

// TEMPORARY: in-memory. DB SWAP: Drizzle queries on `complaint`.

export const complaintRepo = {
  async insert(row: ComplaintRow): Promise<ComplaintRow> {
    memory.complaints.push({ ...row });
    return { ...row };
  },
  async findById(complaintId: string): Promise<ComplaintRow | undefined> {
    const row = memory.complaints.find((c) => c.complaintId === complaintId);
    return row && { ...row };
  },
  /** Newest first. */
  async listByStudent(studentId: string): Promise<ComplaintRow[]> {
    return memory.complaints
      .filter((c) => c.studentId === studentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({ ...c }));
  },
  async hasBeenReregistered(complaintId: string): Promise<boolean> {
    return memory.complaints.some((c) => c.reregisteredFrom === complaintId);
  },
  /**
   * Sets the status to Resolved (only when it is not resolved yet) and returns the updated row, or undefined
   * when there is no such open complaint. DB SWAP: UPDATE complaint SET status = 'Resolved', resolved_at = ...
   * WHERE complaint_id = ... AND status <> 'Resolved' RETURNING *.
   */
  async markResolved(complaintId: string, resolvedAt: string): Promise<ComplaintRow | undefined> {
    const row = memory.complaints.find((c) => c.complaintId === complaintId && c.status !== "Resolved");
    if (!row) return undefined;
    row.status = "Resolved";
    row.resolvedAt = resolvedAt;
    return { ...row };
  },
  // listByHostel(category?) and updateStatus(...) are added with the caretaker screens.
};
