// Which separate slot lists a hostel has, for the supervisor board and export.
// Self-contained: it does NOT depend on the student's newer helpers (slotGroupOf, floorCountOf ...),
// so it works whether or not the student update is already in the project.
// It only uses wingsOf() and HOSTELS, which already exist.

import { HOSTELS } from "@/lib/constants";
import { wingsOf } from "@/lib/hostels";

export const SHARED_SLOT_GROUP = "ALL";

// T6: one slot list for all its wings. Every other hostel: one slot list per wing.
const ONE_SLOT_LIST_FOR_ALL_WINGS = ["t6"];

// Floors per wing, ground floor included. Not listed = 4 floors.
const DEFAULT_FLOORS = 4;

function floorsOfWing(hostelId: string, wing: string): number {
  const w = wing.trim().toUpperCase();
  if (hostelId === "t6") return 2;
  if (hostelId === "brahmaputra") {
    // North (BHN) 6 floors, South (BHS) 5 floors
    if (w.includes("N") && !w.includes("S")) return 6;
    if (w.includes("S") && !w.includes("N")) return 5;
  }
  return DEFAULT_FLOORS;
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
