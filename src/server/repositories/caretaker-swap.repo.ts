import { db } from "@/server/db/client";
import { student, swapRequest } from "@/server/db/schema";
import type { SwapWithStudent } from "@/server/repositories/swap-request.repo";
import { desc, eq } from "drizzle-orm";

export const caretakerSwapRepo = {
  async listByHostel(hostelId: string): Promise<SwapWithStudent[]> {
    return db
      .select({
        swap: swapRequest,
        student,
      })
      .from(swapRequest)
      .innerJoin(student, eq(swapRequest.studentId, student.studentId))
      .where(eq(student.hostelId, hostelId))
      .orderBy(desc(swapRequest.createdAt));
  },
};