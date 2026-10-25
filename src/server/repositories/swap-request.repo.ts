import { memory } from "@/server/db/memory-store";
import type { StudentRow, SwapRequestRow } from "@/server/db/memory-store";
import { studentRepo } from "@/server/repositories/student.repo";

export type SwapWithStudent = { swap: SwapRequestRow; student: StudentRow };

const CLOSED = ["Rejected", "RoomAssigned"];

// TEMPORARY: in-memory. DB SWAP: Drizzle queries on `swap_request`.

export const swapRequestRepo = {
  async insert(row: SwapRequestRow): Promise<SwapRequestRow> {
    memory.swapRequests.push({ ...row });
    return { ...row };
  },
  async findById(swapId: string): Promise<SwapRequestRow | undefined> {
    const row = memory.swapRequests.find((s) => s.swapId === swapId);
    return row && { ...row };
  },
  /** Newest first. */
  async listByStudent(studentId: string): Promise<SwapRequestRow[]> {
    return memory.swapRequests
      .filter((s) => s.studentId === studentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((s) => ({ ...s }));
  },

  /** DB SWAP: update(swapRequest).set(patch).where(eq(swapId, id)).returning() */
  async update(
    swapId: string,
    patch: Partial<Omit<SwapRequestRow, "swapId" | "studentId">>,
  ): Promise<SwapRequestRow | undefined> {
    const row = memory.swapRequests.find((s) => s.swapId === swapId);
    if (!row) return undefined;
    Object.assign(row, patch);
    return { ...row };
  },

  /**
   * A closed request (Rejected or RoomAssigned) keeps its status and room but loses every message
   * (warden / caretaker notes and the caretaker's note to the warden), to save space. Also cleans up older rows.
   * DB SWAP: update swap_request set warden_comment = null, caretaker_comment = null
   *          where status in ('Rejected', 'RoomAssigned') and (warden_comment is not null or caretaker_comment is not null)
   */
  async clearMessagesOfClosed(): Promise<void> {
    for (const swap of memory.swapRequests) {
      if (CLOSED.includes(swap.status) && (swap.wardenComment !== null || swap.caretakerComment !== null)) {
        swap.wardenComment = null;
        swap.caretakerComment = null;
      }
    }
  },

  /**
   * Swap requests forwarded to one warden, newest first.
   * DB SWAP: join swap_request -> student on student_id, where swap_request.warden_id = ?
   */
  async listByWarden(wardenId: string): Promise<SwapWithStudent[]> {
    const out: SwapWithStudent[] = [];
    for (const swap of memory.swapRequests) {
      if (swap.wardenId !== wardenId) continue;
      const student = await studentRepo.findById(swap.studentId); // students are in the real database
      if (student) out.push({ swap: { ...swap }, student });
    }
    return out.sort((a, b) => b.swap.createdAt.localeCompare(a.swap.createdAt));
  },

  /**
   * How many swap requests the students of one hostel made, per batch and per course.
   * Returns numbers only, never names or ids.
   * DB SWAP: two GROUP BY queries (student.batch, student.course) over swap_request joined to student,
   *          where student.hostel_id = ?
   */
  async countsByBatchAndCourse(hostelId: string): Promise<{ byBatch: Map<string, number>; byCourse: Map<string, number> }> {
    const byBatch = new Map<string, number>();
    const byCourse = new Map<string, number>();
    for (const swap of memory.swapRequests) {
      const student = await studentRepo.findById(swap.studentId); // students are in the real database
      if (!student || student.hostelId !== hostelId) continue;
      byBatch.set(student.batch, (byBatch.get(student.batch) ?? 0) + 1);
      byCourse.set(student.course, (byCourse.get(student.course) ?? 0) + 1);
    }
    return { byBatch, byCourse };
  },
};
