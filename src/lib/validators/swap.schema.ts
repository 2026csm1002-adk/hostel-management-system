import { z } from "zod";
import { SWAP_REASON_MAX_CHARS, SWAP_REASON_MIN_CHARS } from "@/lib/constants";

export const submitSwapSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(SWAP_REASON_MIN_CHARS, `Please explain the reason (at least ${SWAP_REASON_MIN_CHARS} characters)`)
    .max(SWAP_REASON_MAX_CHARS, `Keep the reason under ${SWAP_REASON_MAX_CHARS} characters`),
});

// Warden: Accept / Reject. The comment is optional for both.
export const decisionSchema = z.object({
  decision: z.enum(["Accept", "Reject"], { error: "Choose Accept or Reject" }),
  comment: z.string().trim().max(500, "Keep the comment under 500 characters").optional(),
});

// The caretaker marks an accepted request as waiting (no room free): a message for the student is required.
export const messageSchema = z.object({
  message: z.string().trim().min(1, "Write a message for the student").max(500, "Keep the message under 500 characters"),
});

// assignRoomSchema (caretaker) lives in caretaker-swap.schema.ts.

export type SubmitSwapInput = z.infer<typeof submitSwapSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
