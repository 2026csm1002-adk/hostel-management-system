import { updateComplaintStatusSchema } from "@/lib/validators/complaint.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { caretakerComplaintService } from "@/server/services/caretaker-complaint.service";

// PATCH /api/complaints/:id/status  { status: "InProgress" | "Resolved" }   (Caretaker)
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Caretaker"]);
    const { id } = await params;
    const { status } = updateComplaintStatusSchema.parse(await req.json());
    return { complaint: await caretakerComplaintService.updateStatus(user, id, status) };
  });
}
