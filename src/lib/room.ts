// Floor is worked out from the room number, never typed in by the student.
// How it is worked out depends on how the hostel numbers its rooms (HOSTELS in constants.ts):
//
//   rooms start at 101 (Satluj, Beas, Chenab, T6):          floor = floor(room / 100) - 1
//       105 -> 0 (Ground)    207 -> 1 (1st)     309 -> 2 (2nd)
//
//   rooms start at 001 (Brahmaputra, Raavi, Chintpurni):    floor = floor(room / 100)
//       001 -> 0 (Ground)    099 -> 0           101 -> 1 (1st)     207 -> 2 (2nd)
//
// Room numbers such as "A-112" are allowed: the LAST run of digits is used (112).

import { floorCountOf, getHostel } from "@/lib/hostels";

/** Returns the floor number (0 = ground floor), or null when it cannot be worked out. */
export function floorFromRoom(roomNo: string | null | undefined, hostelId: string | null | undefined): number | null {
  const hostel = getHostel(hostelId);
  if (!hostel || !roomNo) return null;
  const runs = roomNo.match(/\d+/g);
  if (!runs) return null;
  const n = parseInt(runs[runs.length - 1], 10);
  if (n < hostel.roomsStartAt) return null; // below the first room of this hostel
  return Math.floor(n / 100) - (hostel.roomsStartAt === 100 ? 1 : 0);
}

/** One sentence telling the student how rooms are numbered in their hostel. */
export function roomHint(hostelId: string | null | undefined): string {
  const hostel = getHostel(hostelId);
  if (!hostel) return "Choose your hostel first.";
  return hostel.roomsStartAt === 1
    ? `Rooms in ${hostel.name} start at 001: 001\u2013099 is the ground floor, 101\u2013199 the 1st floor.`
    : `Rooms in ${hostel.name} start at 101: 101\u2013199 is the ground floor, 201\u2013299 the 1st floor.`;
}

/**
 * null when the room number is usable for this hostel (and wing, when given), otherwise a message
 * for the student. With a wing, the room must also be on a floor that the wing has.
 */
export function roomError(hostelId: string, roomNo: string, wing?: string): string | null {
  const floor = floorFromRoom(roomNo, hostelId);
  if (floor === null) {
    const hostel = getHostel(hostelId);
    if (!hostel) return "Choose your hostel.";
    return `Enter a valid room number for ${hostel.name}. ${roomHint(hostelId)}`;
  }
  if (wing) {
    const count = floorCountOf(hostelId, wing);
    if (floor >= count) {
      const w = wing.trim().toUpperCase();
      return `Room ${roomNo.trim()} is on the ${floorLabel(floor).toLowerCase()}, but wing ${w} has only ${count} floors (ground floor to ${floorLabel(count - 1).toLowerCase()}).`;
    }
  }
  return null;
}

/** 0 -> "Ground floor", 1 -> "1st floor", 2 -> "2nd floor", 11 -> "11th floor", null -> "\u2014" */
export function floorLabel(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return "\u2014";
  if (floor === 0) return "Ground floor";
  const lastTwo = floor % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[floor % 10] ?? "th";
  return `${floor}${suffix} floor`;
}
