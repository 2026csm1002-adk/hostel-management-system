import { z } from "zod";
import { SWAP_REASON_MAX_CHARS, SWAP_REASON_MIN_CHARS } from "@/lib/constants";

export const submitSwapSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(SWAP_REASON_MIN_CHARS, `Please explain the reason (at least ${SWAP_REASON_MIN_CHARS} characters)`)
    .max(SWAP_REASON_MAX_CHARS, `Keep the reason under ${SWAP_REASON_MAX_CHARS} characters`),
});

// Warden: Accept / Reject / Waiting. Reject and Waiting need a comment, because the student
// sees it and needs to know why.
export const decisionSchema = z
  .object({
    decision: z.enum(["Accept", "Reject", "Waiting"], { error: "Choose Accept, Reject or Waiting" }),
    comment: z.string().trim().max(500, "Keep the comment under 500 characters").optional(),
  })
  .refine((d) => d.decision === "Accept" || (d.comment !== undefined && d.comment.length > 0), {
    message: "Please add a comment for Reject or Waiting.",
    path: ["comment"],
  });

// assignRoomSchema (caretaker) is added with the caretaker screens.

export type SubmitSwapInput = z.infer<typeof submitSwapSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
