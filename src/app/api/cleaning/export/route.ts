import { z } from "zod";
import { HOSTELS } from "@/lib/constants";
import { requireUser, respondFile } from "@/server/api-helpers";
import { supervisorService } from "@/server/services/supervisor.service";

// Kept here so the shared cleaning.schema.ts is not touched.
const exportQuerySchema = z.object({
  format: z.enum(["xlsx", "pdf"], { error: "Choose Excel or PDF" }),
  hostelId: z
    .string()
    .refine((id) => HOSTELS.some((h) => h.id === id), "Choose a valid hostel")
    .optional(),
});

// GET /api/cleaning/export?format=xlsx|pdf&hostelId=satluj   (Supervisor only; no hostelId = all hostels)
export function GET(req: Request) {
  return respondFile(async () => {
    const user = await requireUser(["Supervisor"]);
    const { searchParams } = new URL(req.url);
    const { format, hostelId } = exportQuerySchema.parse({
      format: searchParams.get("format"),
      hostelId: searchParams.get("hostelId") ?? undefined,
    });
    return supervisorService.exportSchedule(user, format, hostelId);
  });
}
