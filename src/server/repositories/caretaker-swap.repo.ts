import { memory } from "@/server/db/memory-store";
import { studentRepo } from "@/server/repositories/student.repo";
import type { SwapWithStudent } from "@/server/repositories/swap-request.repo";

// The swap queries a caretaker needs. Students are looked up through studentRepo, so this works
// whether the students are in the database or in memory.
// Changing a request goes through swapRequestRepo.update(), as for the warden.

export const caretakerSwapRepo = {
  /**
   * Swap requests of the students living in one hostel (every wing), newest first.
   * DB SWAP: join swap_request -> student on student_id, where student.hostel_id = ?, order by created_at desc.
   */
  async listByHostel(hostelId: string): Promise<SwapWithStudent[]> {
    const out: SwapWithStudent[] = [];
    for (const swap of memory.swapRequests) {
      const student = await studentRepo.findById(swap.studentId);
      if (student && student.hostelId === hostelId) out.push({ swap: { ...swap }, student });
    }
    return out.sort((a, b) => b.swap.createdAt.localeCompare(a.swap.createdAt));
  },
};
