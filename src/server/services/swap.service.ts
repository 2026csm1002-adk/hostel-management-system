import { randomUUID } from "node:crypto";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import type { DecisionInput, SubmitSwapInput } from "@/lib/validators/swap.schema";
import type { SwapRequestRow } from "@/server/db/memory-store";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { addNote, notesFor } from "@/server/swap-notes";
import { mobileRepo } from "@/server/repositories/mobile.repo";
import { attachmentRepo } from "@/server/repositories/attachment.repo";
import { requireHostel, requireRole } from "@/server/services/auth.service";
import { studentRepo } from "@/server/repositories/student.repo";
import { swapRequestRepo, type SwapWithStudent } from "@/server/repositories/swap-request.repo";
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
    attachmentUrl: attachment ? fileStorage.viewUrl(attachment.storageFileId) : null,
    assignedRoom: row.assignedRoom,
    wardenComment: row.wardenComment,
  };
}

// Student side (submit, listMine) and warden side (listForWarden, decide, stats).
// forward / assignRoom / markAwaitingRoom live in caretaker-swap.service.ts.

async function toStaffDTO({ swap, student }: SwapWithStudent): Promise<StaffSwapDTO> {
  return {
    ...(await toDTO(swap)),
    wardenComment: notesFor(swap.wardenComment, "Warden"), // the caretaker's messages to the student are not shown to the warden
    studentName: student.fullName,
    wing: student.wing,
    roomNo: student.roomNo,
    batch: student.batch,
    course: student.course as StaffSwapDTO["course"],
    email: student.googleEmail,
    mobileNo: (await mobileRepo.get(student.studentId)) ?? "",
  };
}

/** Finds a request that was forwarded to this warden. Anyone else's looks like it does not exist. */
async function loadForWarden(user: SessionUser, swapId: string) {
  requireRole(user, ["Warden"]);
  const swap = await swapRequestRepo.findById(swapId);
  const student = swap && (await studentRepo.findById(swap.studentId));
  if (!swap || !student || swap.wardenId !== user.userId) throw new NotFoundError("Swap request not found.");
  return { swap, student };
}

function mustBe(status: string, allowed: SwapStatus[], action: string) {
  if (!allowed.includes(status as SwapStatus)) {
    throw new ConflictError(`This request is "${status}", so it cannot be ${action}.`);
  }
}

export const swapService = {
  async submit(
    email: string,
    input: SubmitSwapInput,
    file?: File | null,
    driveAccessToken?: string | null,
  ): Promise<SwapDTO> {
    const student = await profileService.requireProfile(email);

    let attachmentId: string | null = null;
    if (file && file.size > 0) {
      checkFile(file);
      const { storageFileId } = await fileStorage.upload(file, driveAccessToken ?? null);
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
    await swapRequestRepo.clearMessagesOfClosed();
    const profile = await profileService.getProfile(email);
    if (!profile) return [];
    const rows = await swapRequestRepo.listByStudent(profile.studentId);
    return Promise.all(rows.map(toDTO));
  },

  /** Warden: the requests the caretakers forwarded to me, newest first. */
  async listForWarden(user: SessionUser): Promise<StaffSwapDTO[]> {
    requireRole(user, ["Warden"]);
    if (!user.userId) return [];
    await swapRequestRepo.clearMessagesOfClosed();
    const rows = await swapRequestRepo.listByWarden(user.userId);
    return Promise.all(rows.map(toStaffDTO));
  },

  /** Warden: Forwarded -> Accepted or Rejected. A Reject needs a comment (checked by the schema). */
  async decide(user: SessionUser, swapId: string, input: DecisionInput): Promise<StaffSwapDTO> {
    const { swap, student } = await loadForWarden(user, swapId);
    mustBe(swap.status, ["Forwarded"], "decided now");
    // A rejection closes the request: its messages are wiped (the status stays, so the student still sees the outcome).
    const updated = await swapRequestRepo.update(
      swapId,
      input.decision === "Reject"
        ? { status: "Rejected", wardenComment: null, caretakerComment: null }
        : {
            status: "Accepted",
            wardenComment: input.comment ? addNote(swap.wardenComment, "Warden", input.comment) : swap.wardenComment,
          },
    );
    return toStaffDTO({ swap: updated!, student });
  },

  /** Warden: anonymous numbers for my hostel (per batch and per course). */
  async stats(user: SessionUser): Promise<SwapStatsDTO> {
    requireRole(user, ["Warden"]);
    const { byBatch, byCourse } = await swapRequestRepo.countsByBatchAndCourse(requireHostel(user));
    const rows = (m: Map<string, number>) =>
      [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { total: [...byCourse.values()].reduce((a, b) => a + b, 0), byBatch: rows(byBatch), byCourse: rows(byCourse) };
  },
};
