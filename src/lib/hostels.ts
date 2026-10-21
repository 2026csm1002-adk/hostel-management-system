import { HOSTELS } from "@/lib/constants";

export type Hostel = (typeof HOSTELS)[number];

export function getHostel(id: string | null | undefined): Hostel | undefined {
  return HOSTELS.find((h) => h.id === id);
}

/** The wings a student of this hostel can choose from (empty for an unknown hostel). */
export function wingsOf(hostelId: string | null | undefined): readonly string[] {
  return getHostel(hostelId)?.wings ?? [];
}

/** null when the wing is valid for the hostel (upper or lower case), otherwise a message for the student. */
export function wingError(hostelId: string, wing: string): string | null {
  const hostel = getHostel(hostelId);
  if (!hostel) return "Choose your hostel.";
  if (hostel.wings.some((w) => w === wing.trim().toUpperCase())) return null;
  return `Choose a wing of ${hostel.name}: ${hostel.wings.join(", ")}.`;
}

// How many floors a wing has, ground floor included (4 -> ground, 1st, 2nd, 3rd).
// A hostel that is not listed here has DEFAULT_FLOORS. A hostel can have one number for
// all its wings, or one number per wing.
const DEFAULT_FLOORS = 4;
const FLOOR_COUNTS: Record<string, number | Record<string, number>> = {
  brahmaputra: { BHN: 6, BHS: 5 },
  t6: 2,
};

/** Number of floors (ground included) of this wing. */
export function floorCountOf(hostelId: string | null | undefined, wing: string | null | undefined): number {
  const entry = hostelId ? FLOOR_COUNTS[hostelId] : undefined;
  if (entry === undefined) return DEFAULT_FLOORS;
  if (typeof entry === "number") return entry;
  return entry[(wing ?? "").trim().toUpperCase()] ?? DEFAULT_FLOORS;
}

// Cleaning slots are shared by a group of rooms. In every hostel except T6 the group is the wing
// (SE and SW of Satluj have separate slots). T6 has one slot list for all its wings.
const ONE_SLOT_LIST_FOR_ALL_WINGS = ["t6"];
export const SHARED_SLOT_GROUP = "ALL";

/** The wing whose slots this student books ("ALL" for T6, where every wing shares the same slots). */
export function slotGroupOf(hostelId: string, wing: string): string {
  return ONE_SLOT_LIST_FOR_ALL_WINGS.includes(hostelId) ? SHARED_SLOT_GROUP : wing.trim().toUpperCase();
}
