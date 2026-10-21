// THE one place for every business number and fixed list.
// Change a rule here once and the whole app follows.

export const MAX_ROOMS_PER_SLOT = 3;
export const BOOKING_MIN_DAYS_AHEAD = 1; // tomorrow
export const BOOKING_MAX_DAYS_AHEAD = 3; // the 3rd day from today
export const REREGISTER_AFTER_DAYS = 7;

// Calendar-day maths (bookings, "7 days old") is done in this time zone.
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

// Swap request rules
export const SWAP_REASON_MIN_CHARS = 10;
export const SWAP_REASON_MAX_CHARS = 1000;
export const COMPLAINT_MAX_CHARS = 2000;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

// One-hour slots: 9-1 and 2-4
export const SLOT_STARTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"] as const;

export const ROLES = ["Student", "Caretaker", "Supervisor", "Warden"] as const;
export const STAFF_ROLES = ["Caretaker", "Supervisor", "Warden"] as const;
export const COURSES = ["BTech", "MTech", "PhD", "Other"] as const;

export const COMPLAINT_CATEGORIES = [
  "Carpenter",
  "Plumbing",
  "Pest Control",
  "Drinking Water",
  "Horticulture",
  "Network & Wifi",
  "Electrical",
  "Others",
] as const;
export const CLEANING_STATUSES = ["Confirmed", "Done"] as const;
export const COMPLAINT_STATUSES = ["Open", "InProgress", "Resolved"] as const;
export const SWAP_STATUSES = [
  "Pending",
  "Forwarded",
  "Accepted",
  "AwaitingRoom",
  "RoomAssigned",
  "Rejected",
  "Waiting",
] as const;

// Every hostel with its wings and how its rooms are numbered.
//   roomsStartAt: 100 -> rooms start at 101 (101-199 is the ground floor)
//   roomsStartAt: 1   -> rooms start at 001 (001-099 is the ground floor, 101-199 the 1st floor)
// Used by the profile form (wing list), the profile validation and the floor calculation (src/lib/room.ts).
export const HOSTELS = [
  { id: "satluj", name: "Satluj", type: "Boys", wings: ["SE", "SW"], roomsStartAt: 100 },
  { id: "beas", name: "Beas", type: "Boys", wings: ["BE", "BW"], roomsStartAt: 100 },
  { id: "chenab", name: "Chenab", type: "Boys", wings: ["CE", "CW"], roomsStartAt: 100 },
  { id: "brahmaputra", name: "Brahmaputra", type: "Boys", wings: ["BHN", "BHS"], roomsStartAt: 1 },
  { id: "raavi", name: "Raavi", type: "Girls", wings: ["RE", "RC", "RW"], roomsStartAt: 1 },
  { id: "chintpurni", name: "Chintpurni", type: "Girls", wings: ["CH"], roomsStartAt: 1 },
  { id: "t6", name: "T6", type: "Girls", wings: ["C", "D", "E", "F", "G"], roomsStartAt: 100 },
] as const;

// Where each role lands after login. Used by src/app/page.tsx and src/proxy.ts
export const ROLE_HOME = {
  Student: "/student",
  Caretaker: "/caretaker/complaints",
  Supervisor: "/supervisor/board",
  Warden: "/warden/swaps",
} as const;

// Floor columns always shown on the supervisor board (0 = ground). A floor above this appears
// automatically once a booking exists on it.
export const DEFAULT_FLOOR_COUNT = 4;
