import { complaintExportQuerySchema } from "@/lib/validators/caretaker-complaint.schema";
import { requireUser, respondFile } from "@/server/api-helpers";
import { caretakerComplaintService } from "@/server/services/caretaker-complaint.service";

// GET /api/complaints/export?format=csv|pdf|xlsx&scope=new|all&category=Plumbing   (Caretaker)
export function GET(req: Request) {
  return respondFile(async () => {
    const user = await requireUser(["Caretaker"]);
    const { searchParams } = new URL(req.url);
    const { format, category, scope } = complaintExportQuerySchema.parse({
      format: searchParams.get("format"),
      category: searchParams.get("category") ?? undefined,
      scope: searchParams.get("scope") ?? undefined,
    });
    return caretakerComplaintService.export(user, format, category, scope);
  });
}
