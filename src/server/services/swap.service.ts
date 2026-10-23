import { randomUUID } from "node:crypto";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import type { DecisionInput, SubmitSwapInput } from "@/lib/validators/swap.schema";
import type { SwapRequestRow } from "@/server/db/memory-store";
import { COURSES } from "@/lib/constants";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { attachmentRepo } from "@/server/repositories/attachment.repo";
import { studentRepo } from "@/server/repositories/student.repo";
import { swapRequestRepo, type SwapWithStudent } from "@/server/repositories/swap-request.repo";
import { requireHostel, requireRole } from "@/server/services/auth.service";
import { profileService } from "@/server/services/profile.service";
import { fileStorage } from "@/server/storage/file-storage.client";
import type { SessionUser, StaffSwapDTO, SwapDTO, SwapStatsDTO, SwapStatus } from "@/types";

function checkFile(file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError(`The file is too large (maximum ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB).`);
  }
  if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    throw new ValidationError("Attach a PDF, JPG or PNG file.");
  }
}

async function toDTO(row: SwapRequestRow): Promise<SwapDTO> {
  const attachment = row.attachmentId ? await attachmentRepo.findById(row.attachmentId) : undefined;
  return {
    id: row.swapId,
    reason: row.reason,
    status: row.status as SwapStatus,
    createdAt: row.createdAt,
    attachmentName: attachment?.fileName ?? null,
    assignedRoom: row.assignedRoom,
    wardenComment: row.wardenComment,
  };
}

async function toStaffDTO({ swap, student }: SwapWithStudent): Promise<StaffSwapDTO> {
  return {
    ...(await toDTO(swap)),
    studentName: student.fullName,
    wing: student.wing,
    roomNo: student.roomNo,
    batch: student.batch,
    course: student.course as StaffSwapDTO["course"],
  };
}

function mustBe(swap: SwapRequestRow, allowed: SwapStatus[], action: string) {
  if (!allowed.includes(swap.status as SwapStatus)) {
    throw new ConflictError(`This request is "${swap.status}", so it cannot be ${action}.`);
  }
}

// Status flow:  Pending -> Forwarded -> Accepted / Rejected / Waiting (warden)
//               Accepted -> RoomAssigned, or AwaitingRoom -> RoomAssigned (caretaker)
// The student side and the caretaker side live here; the warden's decision is added with the warden screen.
export const swapService = {
  async submit(email: string, input: SubmitSwapInput, file?: File | null): Promise<SwapDTO> {
    const student = await profileService.requireProfile(email);

    let attachmentId: string | null = null;
    if (file && file.size > 0) {
      checkFile(file);
      const { storageFileId } = await fileStorage.upload(file);
      const saved = await attachmentRepo.insert({
        attachmentId: randomUUID(),
        storageFileId,
        fileName: file.name.split(/[\\/]/).pop()!.slice(0, 120),
        uploadedAt: new Date().toISOString(),
      });
      attachmentId = saved.attachmentId;
    }

    const row = await swapRequestRepo.insert({
      swapId: randomUUID(),
      studentId: student.studentId,
      reason: input.reason,
      attachmentId,
      status: "Pending",
      assignedRoom: null,
      caretakerId: null,
      wardenId: null,
      wardenComment: null,
      createdAt: new Date().toISOString(),
    });
    return toDTO(row);
  },

  /** My swap requests, newest first. Empty (not an error) while there is no profile. */
  async listMine(email: string): Promise<SwapDTO[]> {
    const profile = await profileService.getProfile(email);
    if (!profile) return [];
    const rows = await swapRequestRepo.listByStudent(profile.studentId);
    return Promise.all(rows.map(toDTO));
  },

  // ---------------------------------------------------------------------------
  // Warden (only sees requests that the caretaker forwarded to this warden)
  // ---------------------------------------------------------------------------

  /** Requests forwarded to me, newest first (any status, so past decisions stay visible). */
  async listForWarden(user: SessionUser): Promise<StaffSwapDTO[]> {
    requireRole(user, ["Warden"]);
    if (!user.userId) throw new ForbiddenError("Your account has no staff id.");
    const rows = await swapRequestRepo.listByWarden(user.userId);
    return Promise.all(rows.map(toStaffDTO));
  },

  /**
   * Forwarded / Waiting  ->  Accepted, Rejected or Waiting.
   * A request on Waiting can later be accepted or rejected, but not put on hold again.
   */
  async decide(user: SessionUser, swapId: string, input: DecisionInput): Promise<StaffSwapDTO> {
    requireRole(user, ["Warden"]);
    if (!user.userId) throw new ForbiddenError("Your account has no staff id.");

    const swap = await swapRequestRepo.findById(swapId);
    // A request forwarded to another warden looks the same as one that does not exist.
    if (!swap || swap.wardenId !== user.userId) throw new NotFoundError("Swap request not found.");
    const student = await studentRepo.findById(swap.studentId);
    if (!student) throw new NotFoundError("Swap request not found.");

    mustBe(swap, ["Forwarded", "Waiting"], "decided on");
    if (swap.status === "Waiting" && input.decision === "Waiting") {
      throw new ConflictError("This request is already on hold. Accept or reject it.");
    }
    if (input.decision !== "Accept" && !input.comment) {
      throw new ValidationError("Please add a comment for Reject or Waiting.");
    }

    const status: SwapStatus =
      input.decision === "Accept" ? "Accepted" : input.decision === "Reject" ? "Rejected" : "Waiting";
    const updated = await swapRequestRepo.update(swapId, {
      status,
      wardenComment: input.comment ? input.comment : null,
    });
    return toStaffDTO({ swap: updated!, student });
  },

  /** Anonymous counts for my hostel: requests per batch and per course. */
  async stats(user: SessionUser): Promise<SwapStatsDTO> {
    requireRole(user, ["Warden"]);
    const { byBatch, byCourse } = await swapRequestRepo.countsByBatchAndCourse(requireHostel(user));
    const total = [...byBatch.values()].reduce((a, b) => a + b, 0);
    return {
      total,
      byBatch: [...byBatch].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
      byCourse: COURSES.filter((c) => byCourse.has(c)).map((c) => ({ label: c, count: byCourse.get(c)! })),
    };
  },
};
