import { describe, it, expect } from "vitest";
import { mobileRepo } from "@/server/repositories/mobile.repo";

describe("Unit: temporary mobile number store", () => {
  it("returns null for a student without a number, and keeps the latest number", async () => {
    expect(await mobileRepo.get("NOSUCH0001")).toBeNull();
    await mobileRepo.set("2026CSM7001", "9876543210");
    expect(await mobileRepo.get("2026CSM7001")).toBe("9876543210");
    await mobileRepo.set("2026CSM7001", "9123456780");
    expect(await mobileRepo.get("2026CSM7001")).toBe("9123456780");
  });
});
