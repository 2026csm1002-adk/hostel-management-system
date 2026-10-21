// Supervisor board shapes. A separate file so the shared src/types/index.ts is not touched.
// One board section per slot group: every wing of the hostel (T6: one section for all its wings).

export type BoardCell = { floor: number; rooms: string[] }; // rooms in seat order (max 3)
export type BoardSlot = { slotStart: string; label: string; cells: BoardCell[] };
export type BoardDay = { date: string; slots: BoardSlot[] };

export type BoardGroup = {
  slotGroup: string; // "SE", "SW", ... or "ALL" (T6)
  label: string;     // "Wing SE", "All wings (C, D, E, F, G)"
  floors: number[];  // columns of this section (each wing has its own number of floors)
  days: BoardDay[];  // same dates as BoardDTO.dates
};

export type BoardDTO = {
  hostelId: string;
  hostelName: string;
  today: string;   // YYYY-MM-DD; dates[0] is today
  dates: string[]; // today .. today + 3 (the furthest day a student can book)
  groups: BoardGroup[];
  stats: { booked: number; fullSlots: number; totalSlots: number };
};
