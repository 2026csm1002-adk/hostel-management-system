import { complaintExportQuerySchema } from "@/lib/validators/caretaker-complaint.schema";
import { requireUser, respondFile } from "@/server/api-helpers";
import { caretakerComplaintService } from "@/server/services/caretaker-complaint.service";

// GET /api/complaints/export?format=csv|pdf   (Caretaker: every complaint of my hostel)
export function GET(req: Request) {
  return respondFile(async () => {
    const user = await requireUser(["Caretaker"]);
    const { searchParams } = new URL(req.url);
    const { format, category } = complaintExportQuerySchema.parse({
      format: searchParams.get("format"),
      category: searchParams.get("category") ?? undefined,
    });
    return caretakerComplaintService.export(user, format, category);
  });
}
