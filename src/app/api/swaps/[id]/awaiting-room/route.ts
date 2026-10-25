import { requireUser, respond } from "@/server/api-helpers";
import { caretakerSwapService } from "@/server/services/caretaker-swap.service";

// POST /api/swaps/:id/awaiting-room   (Caretaker: Accepted -> AwaitingRoom, "no room available yet")
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Caretaker"]);
    const { id } = await params;
    return { swap: await caretakerSwapService.markAwaitingRoom(user, id) };
  });
}
