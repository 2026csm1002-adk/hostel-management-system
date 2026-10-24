import { z } from "zod";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";

// GET /api/complaints?category=Plumbing   (optional filter)
export const complaintListQuerySchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
});

// GET /api/complaints/export?format=csv|pdf|xlsx&category=Plumbing   (category optional)
export const complaintExportQuerySchema = z.object({
  format: z.enum(["csv", "pdf", "xlsx"], { error: "Choose CSV, PDF or Excel" }),
  category: z.enum(COMPLAINT_CATEGORIES).optional(), // one category page, or all when missing
});
