import { forwardSchema } from "@/lib/validators/caretaker-swap.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { caretakerSwapService } from "@/server/services/caretaker-swap.service";

// POST /api/swaps/:id/forward  { comment? }   (Caretaker: Pending -> Forwarded to the warden)
// Save as: src/app/api/swaps/[id]/forward/route.ts
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Caretaker"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({})); // the comment is optional, so an empty body is fine
    const input = forwardSchema.parse(body);
    return { swap: await caretakerSwapService.forward(user, id, input) };
  });
}
