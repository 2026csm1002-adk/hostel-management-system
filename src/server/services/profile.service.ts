import { HOSTELS } from "@/lib/constants";
import { wingError } from "@/lib/hostels";
import { MOBILE_ERROR, normalizeMobile } from "@/lib/mobile";
import { floorFromRoom, floorLabel, roomError } from "@/lib/room";
import { parseStudentEmail } from "@/lib/student-identity";
import type { ProfileInput } from "@/lib/validators/profile.schema";
import type { StudentRow } from "@/server/db/memory-store";
import { ConflictError, ValidationError } from "@/server/errors";
import { mobileRepo } from "@/server/repositories/mobile.repo";
import { studentRepo } from "@/server/repositories/student.repo";
import type { StudentProfile } from "@/types";

/** Database row -> what the browser receives (adds hostel name and the floor). */
export function toProfile(row: StudentRow, mobileNo: string | null): StudentProfile {
  const floor = floorFromRoom(row.roomNo, row.hostelId) ?? 0;
  return {
    studentId: row.studentId,
    fullName: row.fullName,
    email: row.googleEmail,
    hostelId: row.hostelId,
    hostelName: HOSTELS.find((h) => h.id === row.hostelId)?.name ?? row.hostelId,
    wing: row.wing,
    roomNo: row.roomNo,
    floor,
    floorLabel: floorLabel(floor),
    course: row.course as StudentProfile["course"],
    batch: row.batch,
    mobileNo: mobileNo ?? "",
  };
}

export const profileService = {
  /** null while the student has not saved a profile yet. */
  async getProfile(email: string): Promise<StudentProfile | null> {
    const row = await studentRepo.findByEmail(email.trim().toLowerCase());
    return row ? toProfile(row, await mobileRepo.get(row.studentId)) : null;
  },

  /** Every request feature (cleaning, complaint, swap) needs a saved profile. */
  async requireProfile(email: string): Promise<StudentRow> {
    const row = await studentRepo.findByEmail(email.trim().toLowerCase());
    // A profile without a mobile number is an old, incomplete one: it must be completed first.
    if (!row || !(await mobileRepo.get(row.studentId))) {
      throw new ValidationError("Please complete your profile first.");
    }
    return row;
  },

  /**
   * Keeps the saved name the same as the name on the student's Google account. Does nothing when Google
   * gave no name (the saved one stays; no placeholder is ever made up).
   */
  async syncNameFromGoogle(email: string, googleName: string | null | undefined): Promise<void> {
    const name = googleName?.replace(/\s+/g, " ").trim();
    if (!name) return;
    try {
      const row = await studentRepo.findByEmail(email.trim().toLowerCase());
      if (row && row.fullName !== name) await studentRepo.upsert({ ...row, fullName: name });
    } catch (e) {
      console.error("[profile] could not update the name from Google:", e);
    }
  },

  /** `googleName` is the name on the signed-in Google account; when there is one it is used, not what the browser sent. */
  async upsertProfile(email: string, data: ProfileInput, googleName?: string | null): Promise<StudentProfile> {
    // Nothing is saved until every detail is filled (the form checks this too, this service is also called without it).
    const fullName = googleName?.replace(/\s+/g, " ").trim() || data.fullName?.replace(/\s+/g, " ").trim();
    if (!fullName) throw new ValidationError("Enter your full name.");
    if (!data.course) throw new ValidationError("Choose your course.");
    if (!data.mobileNo?.trim()) throw new ValidationError("Enter your mobile number.");
    const mobileNo = normalizeMobile(data.mobileNo);
    if (!mobileNo) throw new ValidationError(`${MOBILE_ERROR}.`);

    const identity = parseStudentEmail(email);
    const existing = await studentRepo.findByEmail(identity.email);

    // Roll no and batch are read-only once the profile exists.
    const studentId = existing?.studentId ?? identity.rollNo ?? data.rollNo?.toUpperCase();
    const batch = existing?.batch ?? identity.batch ?? data.batch;
    if (!studentId) throw new ValidationError("Enter your roll number.");
    if (!batch) throw new ValidationError("Enter your batch.");

    if (!existing && (await studentRepo.findById(studentId))) {
      throw new ConflictError("This roll number already belongs to another profile.");
    }
    // The same checks as the form validation, because this service is also called without it.
    const problem = wingError(data.hostelId, data.wing) ?? roomError(data.hostelId, data.roomNo, data.wing);
    if (problem) throw new ValidationError(problem);

    const saved = await studentRepo.upsert({
      studentId,
      fullName,
      googleEmail: identity.email,
      hostelId: data.hostelId,
      wing: data.wing.toUpperCase(),
      roomNo: data.roomNo,
      course: data.course,
      batch,
    });
    // Saved only after the profile itself was saved.
    await mobileRepo.set(saved.studentId, mobileNo);
    return toProfile(saved, mobileNo);
  },
};
