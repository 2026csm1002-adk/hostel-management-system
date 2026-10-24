import { HOSTELS } from "@/lib/constants";
import { daysBetween, isoDateInZone, todayISO } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/server/errors";
import { caretakerComplaintRepo, type ComplaintWithStudent } from "@/server/repositories/caretaker-complaint.repo";
import { complaintRepo } from "@/server/repositories/complaint.repo";
import { mobileRepo } from "@/server/repositories/mobile.repo";
import { studentRepo } from "@/server/repositories/student.repo";
import { requireHostel, requireRole } from "@/server/services/auth.service";
import { complaintExportService } from "@/server/services/complaint-export.service";
import type { ExportFile } from "@/server/services/export.service";
import type { ComplaintCategory, ComplaintStatus, SessionUser } from "@/types";
import type { StaffComplaintDTO } from "@/types/caretaker";

// Open -> In progress -> Resolved. Open may also go straight to Resolved. Nothing goes backwards.
const NEXT_STATUS: Record<string, ComplaintStatus[]> = {
  Open: ["InProgress", "Resolved"],
  InProgress: ["Resolved"],
  Resolved: [],
};

// A resolved complaint disappears from the caretaker's list 2 days after it was resolved.
const HIDE_RESOLVED_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const stillShown = ({ complaint }: ComplaintWithStudent) =>
  complaint.status !== "Resolved" ||
  !complaint.resolvedAt ||
  Date.now() - new Date(complaint.resolvedAt).getTime() < HIDE_RESOLVED_AFTER_MS;

async function toStaffDTO({ complaint, student }: ComplaintWithStudent): Promise<StaffComplaintDTO> {
  return {
    id: complaint.complaintId,
    category: complaint.category as ComplaintCategory,
    description: complaint.description,
    status: complaint.status as ComplaintStatus,
    createdAt: complaint.createdAt,
    daysOld: daysBetween(isoDateInZone(new Date(complaint.createdAt)), todayISO()),
    studentName: student.fullName,
    email: student.email,
    mobileNo: (await mobileRepo.get(student.studentId)) ?? "",
    wing: student.wing,
    roomNo: student.roomNo,
    reregisteredFrom: complaint.reregisteredFrom,
  };
}

// Always limited to the caretaker's own hostel, every wing of it.
export const caretakerComplaintService = {
  /** Complaints of students living in my hostel, newest first; optional category filter. */
  async list(user: SessionUser, category?: ComplaintCategory): Promise<StaffComplaintDTO[]> {
    requireRole(user, ["Caretaker"]);
    const rows = await caretakerComplaintRepo.listByHostel(requireHostel(user), category);
    return Promise.all(rows.filter(stillShown).map(toStaffDTO));
  },

  async updateStatus(user: SessionUser, complaintId: string, status: ComplaintStatus): Promise<StaffComplaintDTO> {
    requireRole(user, ["Caretaker"]);
    const hostelId = requireHostel(user);

    const complaint = await complaintRepo.findById(complaintId);
    const student = complaint && (await studentRepo.findById(complaint.studentId));
    // A complaint from another hostel looks the same as one that does not exist.
    if (!complaint || !student || student.hostelId !== hostelId) throw new NotFoundError("Complaint not found.");

    if (!NEXT_STATUS[complaint.status]?.includes(status)) {
      throw new ConflictError(
        complaint.status === status
          ? `This complaint is already ${status === "InProgress" ? "in progress" : status.toLowerCase()}.`
          : "A complaint cannot go back to an earlier status.",
      );
    }
    const updated = await caretakerComplaintRepo.updateStatus(
      complaintId,
      status,
      status === "Resolved" ? new Date().toISOString() : null,
    );
    return toStaffDTO({ complaint: updated!, student });
  },

  /** Every complaint of my hostel as a CSV or PDF file. */
  async export(user: SessionUser, format: "csv" | "pdf" | "xlsx", category?: ComplaintCategory): Promise<ExportFile> {
    requireRole(user, ["Caretaker"]);
    const hostelId = requireHostel(user);
    const visible = (await caretakerComplaintRepo.listByHostel(hostelId, category)).filter(stillShown);
    const rows = await Promise.all(visible.map(toStaffDTO));
    const filename = `complaints-${hostelId}${category ? `-${category.toLowerCase()}` : ""}-${todayISO()}.${format}`;
    const hostelName = HOSTELS.find((h) => h.id === hostelId)?.name ?? hostelId;
    // Excel = only NEW complaints (status Open); in-progress and resolved ones are left out.
    if (format === "xlsx") {
      const fresh = rows.filter((r) => r.status === "Open");
      return complaintExportService.xlsx(fresh, filename, category ? [category] : undefined);
    }
    return format === "csv"
      ? complaintExportService.csv(rows, filename)
      : complaintExportService.pdf(rows, hostelName, filename);
  },
};
