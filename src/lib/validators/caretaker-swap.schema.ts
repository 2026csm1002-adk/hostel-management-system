import { z } from "zod";

// The caretaker gives the new room after the warden accepts. Whether it fits the hostel's
// numbering is checked in the service, because that depends on the student's hostel.
export const assignRoomSchema = z.object({
  room: z.string().trim().min(1, "Enter the new room number").max(10, "Room number is too long"),
});

export type AssignRoomInput = z.infer<typeof assignRoomSchema>;

// Caretaker forwards a request to the warden. The comment is optional.
export const forwardSchema = z.object({
  comment: z.string().trim().max(500, "Keep the comment under 500 characters").optional(),
});

export type ForwardInput = z.infer<typeof forwardSchema>;
