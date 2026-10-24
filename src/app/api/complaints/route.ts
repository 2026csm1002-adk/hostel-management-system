import { createComplaintSchema } from "@/lib/validators/complaint.schema";
import { complaintListQuerySchema } from "@/lib/validators/caretaker-complaint.schema";
import { requireStudentEmail, requireUser, respond } from "@/server/api-helpers";
import { caretakerComplaintService } from "@/server/services/caretaker-complaint.service";
import { complaintService } from "@/server/services/complaint.service";

// POST /api/complaints  { category, description }   (Student)
export function POST(req: Request) {
  return respond(async () => {
    const email = await requireStudentEmail();
    const input = createComplaintSchema.parse(await req.json());
    return { complaint: await complaintService.create(email, input) };
  }, 201);
}

// GET /api/complaints
//   Student   -> my complaints
//   Caretaker -> complaints of my hostel, optional ?category=Plumbing
export function GET(req: Request) {
  return respond(async () => {
    const user = await requireUser(["Student", "Caretaker"]);
    if (user.role === "Caretaker") {
      const { searchParams } = new URL(req.url);
      const { category } = complaintListQuerySchema.parse({ category: searchParams.get("category") ?? undefined });
      return { complaints: await caretakerComplaintService.list(user, category) };
    }
    return { complaints: await complaintService.listMine(user.email) };
  });
}
