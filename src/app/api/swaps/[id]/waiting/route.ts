import { messageSchema } from "@/lib/validators/swap.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { caretakerSwapService } from "@/server/services/caretaker-swap.service";

// POST /api/swaps/:id/waiting  { message }   (Caretaker: Accepted -> Waiting, no room free; the message is required)
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Caretaker"]);
    const { id } = await params;
    const input = messageSchema.parse(await req.json());
    return { swap: await caretakerSwapService.markWaiting(user, id, input) };
  });
}
