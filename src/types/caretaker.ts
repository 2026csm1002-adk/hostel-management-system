import type { ComplaintCategory, ComplaintStatus } from "@/types";

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
