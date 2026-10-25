import { messageSchema } from "@/lib/validators/swap.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { caretakerSwapService } from "@/server/services/caretaker-swap.service";
import { swapService } from "@/server/services/swap.service";

// POST /api/swaps/:id/message  { message }   (a note for the student; the status does not change)
//   Caretaker: while the request is Pending (before forwarding)
//   Warden:    while the request is Forwarded (before deciding)
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Caretaker", "Warden"]);
    const { id } = await params;
    const input = messageSchema.parse(await req.json());
    const swap =
      user.role === "Warden" ? await swapService.message(user, id, input) : await caretakerSwapService.message(user, id, input);
    return { swap };
  });
}
