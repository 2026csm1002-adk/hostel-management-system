import { roomError } from "@/lib/room";
import type { AssignRoomInput, ForwardInput } from "@/lib/validators/caretaker-swap.schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { attachmentRepo } from "@/server/repositories/attachment.repo";
import { caretakerSwapRepo } from "@/server/repositories/caretaker-swap.repo";
import { mobileRepo } from "@/server/repositories/mobile.repo";
import { fileStorage } from "@/server/storage/file-storage.client";
import { staffUserRepo } from "@/server/repositories/staff-user.repo";
import { studentRepo } from "@/server/repositories/student.repo";
import { swapRequestRepo, type SwapWithStudent } from "@/server/repositories/swap-request.repo";
import { requireHostel, requireRole } from "@/server/services/auth.service";
import type { SessionUser, StaffSwapDTO, SwapStatus } from "@/types";
import type { CaretakerSwapDTO } from "@/types/caretaker";

// Status flow:  Pending -> Forwarded -> Accepted / Rejected / Waiting (warden, in swap.service.ts)
//               Accepted -> RoomAssigned, or Accepted -> AwaitingRoom -> RoomAssigned (caretaker, here)
// A caretaker only ever works on the requests of their own hostel, every wing of it.

async function toDTO({ swap, student }: SwapWithStudent): Promise<CaretakerSwapDTO> {
  const attachment = swap.attachmentId ? await attachmentRepo.findById(swap.attachmentId) : undefined;
  return {
    id: swap.swapId,
    reason: swap.reason,
    status: swap.status as SwapStatus,
    createdAt: swap.createdAt,
    attachmentName: attachment?.fileName ?? null,
    attachmentUrl: attachment ? fileStorage.viewUrl(attachment.storageFileId) : null,
    caretakerComment: swap.caretakerComment,
    assignedRoom: swap.assignedRoom,
    wardenComment: swap.wardenComment,
    studentName: student.fullName,
    wing: student.wing,
    roomNo: student.roomNo,
    batch: student.batch,
    course: student.course as StaffSwapDTO["course"],
    mobileNo: (await mobileRepo.get(student.studentId)) ?? "",
  };
}

/** Finds a request, but only if the student lives in the caretaker's hostel. */
async function loadOwned(user: SessionUser, swapId: string) {
  requireRole(user, ["Caretaker"]);
  const hostelId = requireHostel(user);
  const swap = await swapRequestRepo.findById(swapId);
  const student = swap && (await studentRepo.findById(swap.studentId));
  // A request from another hostel looks the same as one that does not exist.
  if (!swap || !student || student.hostelId !== hostelId) throw new NotFoundError("Swap request not found.");
  return { swap, student, hostelId };
}

function mustBe(status: string, allowed: SwapStatus[], action: string) {
  if (!allowed.includes(status as SwapStatus)) {
    throw new ConflictError(`This request is "${status}", so it cannot be ${action}.`);
  }
}

export const caretakerSwapService = {
  /** Requests of my hostel, newest first. */
  async list(user: SessionUser): Promise<CaretakerSwapDTO[]> {
    requireRole(user, ["Caretaker"]);
    const rows = await caretakerSwapRepo.listByHostel(requireHostel(user));
    return Promise.all(rows.map(toDTO));
  },

  /** Pending -> Forwarded, to the warden of this hostel, with an optional comment. */
  async forward(user: SessionUser, swapId: string, input: ForwardInput = {}): Promise<CaretakerSwapDTO> {
    const { swap, student, hostelId } = await loadOwned(user, swapId);
    mustBe(swap.status, ["Pending"], "forwarded");
    if (!user.userId) throw new ForbiddenError("Your account has no staff id.");

    const warden = await staffUserRepo.findWardenOfHostel(hostelId);
    if (!warden) throw new ValidationError("No warden is assigned to your hostel yet.");

    const updated = await swapRequestRepo.update(swapId, {
      status: "Forwarded",
      caretakerId: user.userId,
      wardenId: warden.staffId,
      caretakerComment: input.comment ? input.comment : null, // optional note for the warden
    });
    return toDTO({ swap: updated!, student });
  },

  /** Accepted -> AwaitingRoom: the warden said yes, but no room is free yet. */
  async markAwaitingRoom(user: SessionUser, swapId: string): Promise<CaretakerSwapDTO> {
    const { swap, student } = await loadOwned(user, swapId);
    mustBe(swap.status, ["Accepted"], "marked as awaiting a room");
    const updated = await swapRequestRepo.update(swapId, { status: "AwaitingRoom" });
    return toDTO({ swap: updated!, student });
  },

  /** Accepted or AwaitingRoom -> RoomAssigned. */
  async assignRoom(user: SessionUser, swapId: string, input: AssignRoomInput): Promise<CaretakerSwapDTO> {
    const { swap, student } = await loadOwned(user, swapId);
    mustBe(swap.status, ["Accepted", "AwaitingRoom"], "given a room");

    // The new room must be a room that exists in this hostel's numbering (for example 001 or 105).
    const problem = roomError(student.hostelId, input.room);
    if (problem) throw new ValidationError(problem);

    const updated = await swapRequestRepo.update(swapId, { assignedRoom: input.room, status: "RoomAssigned" });
    return toDTO({ swap: updated!, student });
  },
};
