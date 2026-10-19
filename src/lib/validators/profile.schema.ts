import { z } from "zod";
import { COURSES } from "@/lib/constants";
import { getHostel, wingError } from "@/lib/hostels";
import { roomError } from "@/lib/room";

// Shape checks, plus the two rules that depend on the hostel (its wings and its room numbering).
// "Roll no already taken" is a service rule.
export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
    hostelId: z.string().refine((id) => getHostel(id) !== undefined, "Choose your hostel"),
    wing: z.string().trim().min(1, "Choose your wing").max(10, "Wing is too long"),
    roomNo: z.string().trim().min(1, "Enter your room number").max(10, "Room number is too long"),
    course: z.enum(COURSES, { error: "Choose your course" }),
    // Normally read from the institute email. Only needed when the email does not contain them,
    // and only used on the very first save.
    rollNo: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{6,15}$/, "Enter a valid roll number")
      .optional(),
    batch: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Enter the batch as a 4-digit year")
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (!getHostel(d.hostelId)) return; // already reported on the hostel field
    const wing = wingError(d.hostelId, d.wing);
    if (wing) ctx.addIssue({ code: "custom", message: wing, path: ["wing"] });
    const room = roomError(d.hostelId, d.roomNo);
    if (room) ctx.addIssue({ code: "custom", message: room, path: ["roomNo"] });
  });

export type ProfileInput = z.infer<typeof profileSchema>;
