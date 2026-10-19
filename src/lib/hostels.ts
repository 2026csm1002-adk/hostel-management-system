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
