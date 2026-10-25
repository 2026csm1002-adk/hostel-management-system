import { submitSwapSchema } from "@/lib/validators/swap.schema";
import { requireStudentEmail, requireUser, respond } from "@/server/api-helpers";
import { getDriveAccessToken } from "@/server/drive-token";
import { caretakerSwapService } from "@/server/services/caretaker-swap.service";
import { swapService } from "@/server/services/swap.service";

// POST /api/swaps  (multipart form: reason + optional file)
export function POST(req: Request) {
  return respond(async () => {
    const email = await requireStudentEmail();
    const form = await req.formData();
    const input = submitSwapSchema.parse({ reason: form.get("reason") });
    const file = form.get("file");
    const upload = file instanceof File && file.size > 0 ? file : null;
    // The document goes to the student's own Drive, with their own token (only asked for when a file is attached).
    const driveToken = upload ? await getDriveAccessToken(req) : null;
    return { swap: await swapService.submit(email, input, upload, driveToken) };
  }, 201);
}

// GET /api/swaps
//   Student   -> my swap requests
//   Caretaker -> swap requests of my hostel
//   Warden    -> swap requests forwarded to me
export function GET() {
  return respond(async () => {
    const user = await requireUser(["Student", "Caretaker", "Warden"]);
    if (user.role === "Caretaker") return { swaps: await caretakerSwapService.list(user) };
    if (user.role === "Warden") return { swaps: await swapService.listForWarden(user) };
    return { swaps: await swapService.listMine(user.email) };
  });
}
