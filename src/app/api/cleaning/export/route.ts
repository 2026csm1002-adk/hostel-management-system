import { exportQuerySchema } from "@/lib/validators/cleaning.schema";
import { requireUser, respondFile } from "@/server/api-helpers";
import { cleaningService } from "@/server/services/cleaning.service";

// GET /api/cleaning/export?format=csv|pdf&hostelId=satluj   (Supervisor only; no hostelId = all hostels)
export function GET(req: Request) {
  return respondFile(async () => {
    const user = await requireUser(["Supervisor"]);
    const { searchParams } = new URL(req.url);
    const { format, hostelId } = exportQuerySchema.parse({
      format: searchParams.get("format"),
      hostelId: searchParams.get("hostelId") ?? undefined,
    });
    return cleaningService.exportSchedule(user, format, hostelId);
  });
}
