import { decisionSchema } from "@/lib/validators/swap.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { swapService } from "@/server/services/swap.service";

// POST /api/swaps/:id/decision  { decision: "Accept" | "Reject" | "Waiting", comment? }   (Warden)
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const user = await requireUser(["Warden"]);
    const { id } = await params;
    const input = decisionSchema.parse(await req.json());
    return { swap: await swapService.decide(user, id, input) };
  });
}
