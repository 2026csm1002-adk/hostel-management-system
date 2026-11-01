import type { ComplaintCategory, ComplaintStatus, StaffSwapDTO } from "@/types";

/** A complaint as the caretaker sees it: the complaint plus who made it and where they live. */
export type StaffComplaintDTO = {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
  daysOld: number;
  studentName: string;
  email: string;
  mobileNo: string; // so the caretaker can call the student ("" when not saved)
  wing: string;
  roomNo: string;
  reregisteredFrom: string | null;
};

/** A swap request as the caretaker sees it: the request plus who made it, where they live and how to reach them. */
export type CaretakerSwapDTO = StaffSwapDTO & {
  mobileNo: string; // "" when not saved
  attachmentUrl: string | null; // Google Drive link of the student's document (null: no document, or a dev file)
  caretakerComment: string | null; // the note this caretaker sent with the request to the warden
};