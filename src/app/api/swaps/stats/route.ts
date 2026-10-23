import { requireUser, respond } from "@/server/api-helpers";
import { swapService } from "@/server/services/swap.service";

// GET /api/swaps/stats  -> { stats: { total, byBatch, byCourse } }   (Warden; numbers only, no names)
export function GET() {
  return respond(async () => {
    const user = await requireUser(["Warden"]);
    return { stats: await swapService.stats(user) };
  });
}
