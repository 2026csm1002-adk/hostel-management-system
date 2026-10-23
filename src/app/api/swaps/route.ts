import { submitSwapSchema } from "@/lib/validators/swap.schema";
import { requireStudentEmail, requireUser, respond } from "@/server/api-helpers";
import { swapService } from "@/server/services/swap.service";

// POST /api/swaps  (multipart form: reason + optional file)
export function POST(req: Request) {
  return respond(async () => {
    const email = await requireStudentEmail();
    const form = await req.formData();
    const input = submitSwapSchema.parse({ reason: form.get("reason") });
    const file = form.get("file");
    return { swap: await swapService.submit(email, input, file instanceof File ? file : null) };
  }, 201);
}

// GET /api/swaps
//   Student -> my swap requests
//   Warden  -> requests forwarded to me
// (the caretaker's list is added with the caretaker screens)
export function GET() {
  return respond(async () => {
    const user = await requireUser(["Student", "Warden"]);
    if (user.role === "Warden") return { swaps: await swapService.listForWarden(user) };
    return { swaps: await swapService.listMine(user.email) };
  });
}
