import { describe, it, expect } from "vitest";
import { normalizeMobile } from "@/lib/mobile";

describe("Unit: mobile number", () => {
  it("accepts a 10-digit number and the usual ways of writing it", () => {
    expect(normalizeMobile("9876543210")).toBe("9876543210");
    expect(normalizeMobile("98765 43210")).toBe("9876543210");
    expect(normalizeMobile("+91 98765-43210")).toBe("9876543210");
    expect(normalizeMobile("919876543210")).toBe("9876543210");
    expect(normalizeMobile("09876543210")).toBe("9876543210");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "12345", "5876543210", "98765432101", "98765abcde", "+1 9876543210"]) {
      expect(normalizeMobile(bad)).toBeNull();
    }
  });
});
