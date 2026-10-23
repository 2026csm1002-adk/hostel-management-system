import type {
  CLEANING_STATUSES,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  COURSES,
  ROLES,
  SWAP_STATUSES,
} from "@/lib/constants";

export type Role = (typeof ROLES)[number];
export type Course = (typeof COURSES)[number];
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export type SwapStatus = (typeof SWAP_STATUSES)[number];
export type CleaningStatus = (typeof CLEANING_STATUSES)[number];

export type SessionUser = {
  email: string;
  role: Role;
  userId: string | null;   // null = student who has not created a profile yet
  hostelId: string | null; // null for the Supervisor and for such a student
};

// ---------------------------------------------------------------------------
// Data shapes the API sends to the browser (DTOs). Services build these from
// database rows, so the UI never depends on table column names.
// ---------------------------------------------------------------------------

export type StudentProfile = {
  studentId: string; // roll no
  fullName: string;
  email: string;
  hostelId: string;
  hostelName: string;
  wing: string;
  roomNo: string;
  floor: number;      // worked out from roomNo: 0 = ground floor
  floorLabel: string; // "Ground floor", "1st floor", ...
  course: Course;
  batch: string;
  mobileNo: string;
};

export type SlotAvailability = {
  slotStart: string; // "09:00"
  label: string;     // "9:00–10:00 AM"
  filled: number;
  capacity: number;
  status: "Available" | "Full";
  bookedByMe: boolean; // my room already holds a seat in this slot
};

export type CleaningBookingDTO = {
  id: string;
  date: string; // YYYY-MM-DD
  slotStart: string;
  label: string;
  floor: number;
  floorLabel: string;
  wing: string;
  roomNo: string;
  seat: number;
  status: CleaningStatus;
};

export type ComplaintDTO = {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  createdAt: string; // ISO timestamp
  daysOld: number;
  canReregister: boolean;
  reregisteredFrom: string | null;
  reregistered: boolean; // a newer complaint already replaced this one
};

export type SwapDTO = {
  id: string;
  reason: string;
  status: SwapStatus;
  createdAt: string;
  attachmentName: string | null;
  assignedRoom: string | null;
  wardenComment: string | null;
};

// ---- Supervisor board -------------------------------------------------------

export type BoardCell = { floor: number; rooms: string[] }; // rooms in seat order (max 3)
export type BoardSlot = { slotStart: string; label: string; cells: BoardCell[] };
export type BoardDay = { date: string; slots: BoardSlot[] };

/** One slot list: a wing (SE, SW, ...) or, for T6, "All wings" (every T6 wing shares the same slots). */
export type BoardGroup = {
  key: string;      // "SE", "SW", ... or "ALL"
  label: string;    // "Wing SE" / "All wings"
  shared: boolean;  // true for T6: rooms are shown with their wing, e.g. "C-105"
  floors: number[]; // columns of this wing's board (its own number of floors)
  days: BoardDay[];
  booked: number;
};

export type BoardDTO = {
  hostelId: string;
  hostelName: string;
  today: string;    // YYYY-MM-DD; dates[0] is today
  dates: string[];  // today .. today + 3
  groups: BoardGroup[]; // every wing of the hostel
  stats: { booked: number; fullSlots: number; totalSlots: number };
};

// ---- Staff views of swap requests (caretaker and warden) --------------------

export type StaffSwapDTO = SwapDTO & {
  studentName: string;
  wing: string;
  roomNo: string;
  batch: string;
  course: Course;
};

// ---- Warden -----------------------------------------------------------------

export type CountRow = { label: string; count: number };

/** Anonymous numbers only: how many swap requests per batch and per course. No names, no ids. */
export type SwapStatsDTO = {
  total: number;
  byBatch: CountRow[];
  byCourse: CountRow[];
};
