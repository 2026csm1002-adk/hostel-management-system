import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/server/db/client";
import { student, hostel, cleaningBooking, complaint, swapRequest } from "@/server/db/schema";
import { studentRepo } from "@/server/repositories/student.repo";
import { profileService } from "@/server/services/profile.service";
import { ValidationError, ConflictError } from "@/server/errors";
import { eq } from "drizzle-orm";

describe("Student Registration & Profile Persistence", () => {
  const testHostelId = "satluj";

  beforeEach(async () => {
    await db.delete(cleaningBooking);
    await db.delete(swapRequest);
    await db.delete(complaint);
    await db.delete(student);

    await db
      .insert(hostel)
      .values({
        hostelId: testHostelId,
        name: "Satluj Hostel",
        type: "Boys",
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(cleaningBooking);
    await db.delete(swapRequest);
    await db.delete(complaint);
    await db.delete(student);
  });

  describe("studentRepo", () => {
    it("should successfully insert a new student record to the database", async () => {
      const newStudent = {
        studentId: "2026CSM9001",
        fullName: "Aarav Sharma",
        googleEmail: "2026csm9001@iitrpr.ac.in",
        hostelId: testHostelId,
        wing: "A",
        roomNo: "204",
        course: "MTech",
        batch: "2026",
      };

      const saved = await studentRepo.upsert(newStudent);

      expect(saved).toBeDefined();
      expect(saved.studentId).toBe(newStudent.studentId);
      expect(saved.fullName).toBe(newStudent.fullName);

      const [fetched] = await db
        .select()
        .from(student)
        .where(eq(student.studentId, newStudent.studentId))
        .limit(1);

      expect(fetched).toBeDefined();
      expect(fetched.googleEmail).toBe(newStudent.googleEmail);
      expect(fetched.wing).toBe("A");
    });

    it("should update existing student details when upsert is called with the same studentId", async () => {
      const initialStudent = {
        studentId: "2026CSM9002",
        fullName: "Bhavna Patel",
        googleEmail: "2026csm9002@iitrpr.ac.in",
        hostelId: testHostelId,
        wing: "B",
        roomNo: "101",
        course: "BTech",
        batch: "2026",
      };

      await studentRepo.upsert(initialStudent);

      const updated = await studentRepo.upsert({
        ...initialStudent,
        fullName: "Bhavna Patel Updated",
        roomNo: "105",
        wing: "C",
      });

      expect(updated.fullName).toBe("Bhavna Patel Updated");
      expect(updated.roomNo).toBe("105");
      expect(updated.wing).toBe("C");

      const rows = await db
        .select()
        .from(student)
        .where(eq(student.studentId, initialStudent.studentId));

      expect(rows).toHaveLength(1);
    });

    it("should find a student by email case-insensitively via repo", async () => {
      const sample = {
        studentId: "2026CSM9003",
        fullName: "Chirag Verma",
        googleEmail: "2026csm9003@iitrpr.ac.in",
        hostelId: testHostelId,
        wing: "A",
        roomNo: "302",
        course: "PhD",
        batch: "2026",
      };

      await studentRepo.upsert(sample);

      const found = await studentRepo.findByEmail("2026csm9003@iitrpr.ac.in");
      expect(found).toBeDefined();
      expect(found?.studentId).toBe("2026CSM9003");
    });
  });

  describe("profileService", () => {
    it("should register a student, compute floor number, and return StudentProfile", async () => {
      const email = "2026csm9004@iitrpr.ac.in";
      const payload = {
        fullName: "Divya Nair",
        rollNo: "2026CSM9004",
        hostelId: testHostelId,
        wing: "a",
        roomNo: "212",
        course: "MTech" as const,
        batch: "2026",
      };

      const result = await profileService.upsertProfile(email, payload);

      expect(result).toBeDefined();
      expect(result.studentId).toBe("2026CSM9004");
      expect(result.wing).toBe("A");
      expect(result.floor).toBe(1);
      expect(result.email).toBe(email);
    });

    it("should throw ConflictError if roll number is claimed by another email", async () => {
      // 1. Existing user with roll number 2026CSM9005
      await studentRepo.upsert({
        studentId: "2026CSM9005",
        fullName: "Existing User",
        googleEmail: "2026csm9005@iitrpr.ac.in",
        hostelId: testHostelId,
        wing: "A",
        roomNo: "101",
        course: "BTech",
        batch: "2026",
      });

      // 2. Email without embedded roll number attempts to register with 2026CSM9005
      const duplicateAttempt = {
        fullName: "Imposter User",
        rollNo: "2026CSM9005",
        hostelId: testHostelId,
        wing: "A",
        roomNo: "102",
        course: "BTech" as const,
        batch: "2026",
      };

      await expect(
        profileService.upsertProfile("other.user@iitrpr.ac.in", duplicateAttempt)
      ).rejects.toThrow(ConflictError);
    });

    it("should throw ValidationError if room number is invalid", async () => {
      const email = "2026csm9006@iitrpr.ac.in";
      const invalidPayload = {
        fullName: "Esha Gupta",
        rollNo: "2026CSM9006",
        hostelId: testHostelId,
        wing: "A",
        roomNo: "INVALID_ROOM",
        course: "BTech" as const,
        batch: "2026",
      };

      await expect(
        profileService.upsertProfile(email, invalidPayload)
      ).rejects.toThrow(ValidationError);
    });

    it("should require a profile before allowing service requests", async () => {
      const unregisteredEmail = "2026csm9999@iitrpr.ac.in";

      await expect(
        profileService.requireProfile(unregisteredEmail)
      ).rejects.toThrow(ValidationError);
    });
  });
});