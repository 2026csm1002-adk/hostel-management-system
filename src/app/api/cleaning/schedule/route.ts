import { scheduleQuerySchema } from "@/lib/validators/cleaning.schema";
import { requireUser, respond } from "@/server/api-helpers";
import { supervisorService } from "@/server/services/supervisor.service";

// GET /api/cleaning/schedule?hostelId=satluj   (Supervisor only) -> every wing of the hostel
export function GET(req: Request) {
  return respond(async () => {
    const user = await requireUser(["Supervisor"]);
    const { searchParams } = new URL(req.url);
    const { hostelId } = scheduleQuerySchema.parse({ hostelId: searchParams.get("hostelId") });
    return { board: await supervisorService.getBoard(user, hostelId) };
  });
}
