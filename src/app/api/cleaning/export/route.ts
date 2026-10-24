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
  // the day selected on the board (YYYY-MM-DD); the service checks it is one of the board's days
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid day").optional(),
});

// GET /api/cleaning/export?format=xlsx|pdf&hostelId=satluj&date=2026-10-22   (Supervisor only; no hostelId = all hostels; date = the selected day, optional)
export function GET(req: Request) {
  return respondFile(async () => {
    const user = await requireUser(["Supervisor"]);
    const { searchParams } = new URL(req.url);
    const { format, hostelId, date } = exportQuerySchema.parse({
      format: searchParams.get("format"),
      hostelId: searchParams.get("hostelId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
    });
    return supervisorService.exportSchedule(user, format, hostelId, date);
  });
}
