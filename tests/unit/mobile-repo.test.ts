import { beforeEach, describe, expect, it } from "vitest";
import { mobileRepo } from "@/server/repositories/mobile.repo";
import { studentRepo } from "@/server/repositories/student.repo";
import { resetDb } from "../helpers";

// The mobile number is a column of the student row, so the student must exist before a number can be saved.
describe("Unit: mobile number of a student", () => {
  beforeEach(() => resetDb());

  const newStudent = (studentId: string) => ({
    studentId,
    fullName: "Test Student",
    googleEmail: `${studentId.toLowerCase()}@iitrpr.ac.in`,
    hostelId: "satluj",
    wing: "SE",
    roomNo: "105",
    course: "MTech",
    batch: "2026",
  });

  it("returns null for a student who does not exist or has no number, and keeps the latest number", async () => {
    expect(await mobileRepo.get("NOSUCH0001")).toBeNull();

    await studentRepo.upsert(newStudent("2026CSM7001"));
    expect(await mobileRepo.get("2026CSM7001")).toBeNull(); // saved student, no number yet

    await mobileRepo.set("2026CSM7001", "9876543210");
    expect(await mobileRepo.get("2026CSM7001")).toBe("9876543210");

    await mobileRepo.set("2026CSM7001", "9123456780");
    expect(await mobileRepo.get("2026CSM7001")).toBe("9123456780");
  });

  it("saving a number for a student who does not exist changes nothing", async () => {
    await mobileRepo.set("2026CSM7002", "9876543210");
    expect(await mobileRepo.get("2026CSM7002")).toBeNull();
  });

  it("each student keeps their own number", async () => {
    await studentRepo.upsert(newStudent("2026CSM7003"));
    await studentRepo.upsert(newStudent("2026CSM7004"));
    await mobileRepo.set("2026CSM7003", "9000000001");
    await mobileRepo.set("2026CSM7004", "9000000002");
    expect(await mobileRepo.get("2026CSM7003")).toBe("9000000001");
    expect(await mobileRepo.get("2026CSM7004")).toBe("9000000002");
  });
});
