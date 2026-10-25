import { assignRoomSchema } from "@/lib/validators/caretaker-swap.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { caretakerSwapService } from "@/server/services/caretaker-swap.service";

// POST /api/swaps/:id/assign-room  { room }   (Caretaker: Accepted / AwaitingRoom -> RoomAssigned)
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Caretaker"]);
    const { id } = await params;
    const input = assignRoomSchema.parse(await req.json());
    return { swap: await caretakerSwapService.assignRoom(user, id, input) };
  });
}
