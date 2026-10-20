import { scheduleQuerySchema } from "@/lib/validators/cleaning.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { cleaningService } from "@/server/services/cleaning.service";

// GET /api/cleaning/schedule?hostelId=satluj   (Supervisor only)
export function GET(req: Request) {
  return respond(async () => {
    const user = await requireUser(["Supervisor"]);
    const { searchParams } = new URL(req.url);
    const { hostelId } = scheduleQuerySchema.parse({ hostelId: searchParams.get("hostelId") });
    return { board: await cleaningService.getBoard(user, hostelId) };
  });
}
