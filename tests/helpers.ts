// tests/helpers.ts: small helpers shared by the integration tests.
import { randomUUID } from "node:crypto";
import { HOSTELS } from "@/lib/constants";
import { db } from "@/server/db/client";
import { attachment, cleaningBooking, complaint, hostel, staffUser, student, swapRequest } from "@/server/db/schema";

export type StaffSeed = {
  name: string;
  email: string;
  role: "Caretaker" | "Supervisor" | "Warden";
  hostel?: string; // hostel id such as "satluj"
};

/**
 * Empties every table (children first), puts the seven hostels back and adds the given staff.
 * Call it in beforeEach so every test starts from the same empty database.
 */
export async function resetDb(staff: StaffSeed[] = []) {
  await db.delete(swapRequest);
  await db.delete(attachment);
  await db.delete(cleaningBooking);
  await db.delete(complaint);
  await db.delete(student);
  await db.delete(staffUser);

  await db
    .insert(hostel)
    .values(HOSTELS.map((h) => ({ hostelId: h.id, name: h.name, type: h.type })))
    .onConflictDoNothing();

  for (const s of staff) {
    await db.insert(staffUser).values({
      staffId: randomUUID(),
      fullName: s.name,
      googleEmail: s.email.trim().toLowerCase(),
      role: s.role,
      hostelId: s.role === "Supervisor" ? null : (s.hostel ?? null),
    });
  }
}
