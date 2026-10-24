// Which separate slot lists a hostel has, for the supervisor board and export.
// Self-contained: it does NOT depend on the student's newer helpers (slotGroupOf, floorCountOf ...),
// so it works whether or not the student update is already in the project.
// It only uses wingsOf() and HOSTELS, which already exist.

import { HOSTELS } from "@/lib/constants";
import { wingsOf } from "@/lib/hostels";

export const SHARED_SLOT_GROUP = "ALL";

// T6: one slot list for all its wings. Every other hostel: one slot list per wing.
const ONE_SLOT_LIST_FOR_ALL_WINGS = ["t6"];

// ---------------------------------------------------------------------------
// FLOORS PER HOSTEL (ground floor included). Edit the numbers here by hand.
// A hostel not listed here has DEFAULT_FLOORS floors.
// For a hostel with wings of different height, list each wing (BHN, BHS) instead of one number.
// ---------------------------------------------------------------------------
const DEFAULT_FLOORS = 4;

const FLOORS: Record<string, number | Record<string, number>> = {
  chintpurni: 3,
  t6: 2,
  brahmaputra: { BHN: 6, BHS: 5 },
};

function floorsOfWing(hostelId: string, wing: string): number {
  const entry = FLOORS[hostelId];
  if (entry === undefined) return DEFAULT_FLOORS;
  if (typeof entry === "number") return entry;
  const w = wing.trim().toUpperCase();
  if (entry[w] !== undefined) return entry[w];
  // wing written as "North" / "South" instead of BHN / BHS
  const first = Object.keys(entry)[0] ?? "";
  const letters = Object.keys(entry).map((k) => k.slice(-1));
  const hit = Object.keys(entry).find((k) => w.includes(k.slice(-1)) && letters.filter((l) => w.includes(l)).length === 1);
  return hit ? entry[hit] : entry[first] ?? DEFAULT_FLOORS;
}

export type SlotGroup = {
  slotGroup: string; // the wing (SE, SW, ...) or "ALL" for T6
  label: string;     // "Wing SE" or "All wings (C, D, E, F, G)"
  wings: readonly string[];
  floorCount: number; // floors of this group, ground included
};

/** One group per wing; a hostel whose wings share slots (T6) gives a single group. */
export function slotGroupsOf(hostelId: string): SlotGroup[] {
  if (!HOSTELS.some((h) => h.id === hostelId)) return [];
  const wings = wingsOf(hostelId);
  if (ONE_SLOT_LIST_FOR_ALL_WINGS.includes(hostelId)) {
    return [
      {
        slotGroup: SHARED_SLOT_GROUP,
        label: `All wings (${wings.join(", ")})`,
        wings,
        floorCount: Math.max(...wings.map((w) => floorsOfWing(hostelId, w))),
      },
    ];
  }
  return wings.map((w) => ({
    slotGroup: w.trim().toUpperCase(),
    label: `Wing ${w}`,
    wings: [w],
    floorCount: floorsOfWing(hostelId, w),
  }));
}

/**
 * The group a booking belongs to. New bookings store it (slotGroup); older bookings do not, so then
 * it is worked out from the booking student's wing (T6: always "ALL").
 */
export function groupOfBooking(hostelId: string, storedGroup: string | undefined, studentWing: string | undefined): string {
  if (ONE_SLOT_LIST_FOR_ALL_WINGS.includes(hostelId)) return SHARED_SLOT_GROUP;
  const stored = (storedGroup ?? "").trim();
  if (stored) return stored.toUpperCase();
  return (studentWing ?? "").trim().toUpperCase();
}
