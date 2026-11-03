import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { staffUser } from "@/server/db/schema";
import { ForbiddenError } from "@/server/errors";
import { studentRepo } from "@/server/repositories/student.repo";
import { requireHostel, requireRole, resolveRole } from "@/server/services/auth.service";
import { resetDb } from "../helpers";

// The staff list is the staff_user table: a staff email gets its role, anyone else is a Student.
describe("Integration: role lookup and guards (staff from the database)", () => {
  beforeEach(() =>
    resetDb([
      { name: "C", email: "Care@iitrpr.ac.in", role: "Caretaker", hostel: "satluj" },
      { name: "W", email: "ward@iitrpr.ac.in", role: "Warden", hostel: "beas" },
      { name: "S", email: "sup@iitrpr.ac.in", role: "Supervisor" },
      { name: "NoHostel", email: "bad@iitrpr.ac.in", role: "Caretaker" }, // a caretaker row with no hostel
    ]),
  );

  it("staff emails get their role, id and hostel (email match ignores case)", async () => {
    expect(await resolveRole("care@iitrpr.ac.in")).toMatchObject({ role: "Caretaker", hostelId: "satluj" });
    expect(await resolveRole("WARD@iitrpr.ac.in")).toMatchObject({ role: "Warden", hostelId: "beas" });
    expect(await resolveRole("sup@iitrpr.ac.in")).toMatchObject({ role: "Supervisor", hostelId: null });

    expect((await resolveRole("care@iitrpr.ac.in")).userId).toBeTruthy(); // the staff_id from the table
  });

  it("anyone else is a Student: with no id until the profile exists, then with their roll number and hostel", async () => {
    expect(await resolveRole("2026csm1099@iitrpr.ac.in")).toMatchObject({ role: "Student", userId: null, hostelId: null });

    await studentRepo.upsert({
      studentId: "2026CSM1099",
      fullName: "Some Student",
      googleEmail: "2026csm1099@iitrpr.ac.in",
      hostelId: "beas",
      wing: "BE",
      roomNo: "105",
      course: "MTech",
      batch: "2026",
    });
    expect(await resolveRole("2026csm1099@iitrpr.ac.in")).toMatchObject({
      role: "Student",
      userId: "2026CSM1099",
      hostelId: "beas",
    });
  });

  it("a caretaker row without a hostel keeps the role but has no hostel, so every hostel screen refuses it", async () => {
    const r = await resolveRole("bad@iitrpr.ac.in");
    expect(r).toMatchObject({ role: "Caretaker", hostelId: null });
    expect(() => requireHostel(r)).toThrow(ForbiddenError);
  });

  it("the database itself refuses an unknown staff role", async () => {
    await expect(
      db.insert(staffUser).values({
        staffId: "x-1",
        fullName: "Bad2",
        googleEmail: "bad2@iitrpr.ac.in",
        role: "Janitor",
        hostelId: "beas",
      }),
    ).rejects.toThrow();
    expect((await resolveRole("bad2@iitrpr.ac.in")).role).toBe("Student");
  });

  it("requireRole allows listed roles and refuses the rest with 403", () => {
    const user = { email: "a@b.c", role: "Warden" as const, userId: "x", hostelId: "beas" };
    expect(() => requireRole(user, ["Warden"])).not.toThrow();
    expect(() => requireRole(user, ["Caretaker", "Supervisor"])).toThrow(ForbiddenError);
    expect(() => requireRole(null, ["Student"])).toThrow(ForbiddenError);
  });

  it("requireHostel refuses staff without a hostel", () => {
    expect(requireHostel({ hostelId: "beas" })).toBe("beas");
    expect(() => requireHostel({ hostelId: null })).toThrow(ForbiddenError);
  });
});
