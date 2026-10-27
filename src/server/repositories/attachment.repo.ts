import { db } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export type AttachmentRow = typeof attachment.$inferSelect;
export type NewAttachmentRow = typeof attachment.$inferInsert;

export const attachmentRepo = {
  async insert(row: NewAttachmentRow): Promise<AttachmentRow> {
    const [inserted] = await db.insert(attachment).values(row).returning();
    return inserted;
  },

  async findById(attachmentId: string): Promise<AttachmentRow | undefined> {
    const [row] = await db
      .select()
      .from(attachment)
      .where(eq(attachment.attachmentId, attachmentId))
      .limit(1);
    return row;
  },
};