import { describe, it, expect } from "vitest";
import { HOSTELS } from "@/lib/constants";
import { floorCountOf, getHostel, slotGroupOf, wingError, wingsOf } from "@/lib/hostels";
import { floorFromRoom, floorLabel, roomError, roomHint } from "@/lib/room";

describe("Unit: floor from room number, hostels whose rooms start at 101", () => {
  it("105 is the ground floor, 207 the 1st, 309 the 2nd", () => {
    expect(floorFromRoom("105", "satluj")).toBe(0);
    expect(floorFromRoom("207", "satluj")).toBe(1);
    expect(floorFromRoom("208", "beas")).toBe(1);
    expect(floorFromRoom("309", "chenab")).toBe(2);
    expect(floorFromRoom("1204", "t6")).toBe(11);
  });
  it("uses the last run of digits for rooms like A-112", () => {
    expect(floorFromRoom("A-112", "satluj")).toBe(0);
    expect(floorFromRoom("B-310", "beas")).toBe(2);
  });
  it("rooms below 100 do not exist there", () => {
    expect(floorFromRoom("45", "satluj")).toBeNull();
    expect(floorFromRoom("001", "satluj")).toBeNull();
  });
});

describe("Unit: floor from room number, hostels whose rooms start at 001", () => {
  const hostels = ["brahmaputra", "raavi", "chintpurni"];
  it("001 to 099 is the ground floor; 101 is the 1st; 207 is the 2nd", () => {
    for (const h of hostels) {
      expect(floorFromRoom("001", h)).toBe(0);
      expect(floorFromRoom("099", h)).toBe(0);
      expect(floorFromRoom("1", h)).toBe(0);
      expect(floorFromRoom("101", h)).toBe(1);
      expect(floorFromRoom("199", h)).toBe(1);
      expect(floorFromRoom("207", h)).toBe(2);
      expect(floorFromRoom("309", h)).toBe(3);
    }
  });
  it("room 000 does not exist", () => {
    expect(floorFromRoom("000", "raavi")).toBeNull();
  });
  it("the same number is a different floor in the two kinds of hostel", () => {
    expect(floorFromRoom("207", "satluj")).toBe(1);
    expect(floorFromRoom("207", "raavi")).toBe(2);
  });
});

describe("Unit: floor edge cases and labels", () => {
  it("returns null when no floor can be worked out", () => {
    expect(floorFromRoom("", "satluj")).toBeNull();
    expect(floorFromRoom("ABC", "satluj")).toBeNull();
    expect(floorFromRoom(null, "satluj")).toBeNull();
    expect(floorFromRoom("105", "nowhere")).toBeNull();
    expect(floorFromRoom("105", "")).toBeNull();
  });
  it("labels floors", () => {
    expect(floorLabel(0)).toBe("Ground floor");
    expect(floorLabel(1)).toBe("1st floor");
    expect(floorLabel(2)).toBe("2nd floor");
    expect(floorLabel(3)).toBe("3rd floor");
    expect(floorLabel(4)).toBe("4th floor");
    expect(floorLabel(11)).toBe("11th floor");
    expect(floorLabel(null)).toBe("\u2014");
  });
  it("explains each hostel's numbering", () => {
    expect(roomHint("raavi")).toContain("start at 001");
    expect(roomHint("satluj")).toContain("start at 101");
    expect(roomError("raavi", "000")).toContain("Raavi");
    expect(roomError("raavi", "001")).toBeNull();
    expect(roomError("satluj", "001")).toContain("Satluj");
  });
});

describe("Unit: wings of each hostel", () => {
  it("matches the hostel list", () => {
    expect(wingsOf("satluj")).toEqual(["SE", "SW"]);
    expect(wingsOf("beas")).toEqual(["BE", "BW"]);
    expect(wingsOf("chenab")).toEqual(["CE", "CW"]);
    expect(wingsOf("raavi")).toEqual(["RE", "RC", "RW"]);
    expect(wingsOf("brahmaputra")).toEqual(["BHN", "BHS"]);
    expect(wingsOf("chintpurni")).toEqual(["CH"]);
    expect(wingsOf("t6")).toEqual(["C", "D", "E", "F", "G"]);
    expect(wingsOf("nowhere")).toEqual([]);
  });
  it("accepts a wing of that hostel in any case, and rejects another hostel's wing", () => {
    expect(wingError("satluj", "se")).toBeNull();
    expect(wingError("satluj", " SW ")).toBeNull();
    expect(wingError("satluj", "BE")).toContain("SE, SW");
    expect(wingError("raavi", "SE")).toContain("RE, RC, RW");
    expect(wingError("nowhere", "SE")).toBe("Choose your hostel.");
  });
  it("every hostel has at least one wing, and a room numbering start of 1 or 100", () => {
    for (const h of HOSTELS) {
      expect(getHostel(h.id)!.wings.length > 0).toBe(true);
      expect([1, 100].includes(h.roomsStartAt)).toBe(true);
    }
  });
});

describe("Unit: number of floors of each wing", () => {
  it("Brahmaputra North has 6 floors, South has 5, each T6 wing has 2, all others 4", () => {
    expect(floorCountOf("brahmaputra", "BHN")).toBe(6);
    expect(floorCountOf("brahmaputra", "bhs")).toBe(5);
    for (const w of ["C", "D", "E", "F", "G"]) expect(floorCountOf("t6", w)).toBe(2);
    expect(floorCountOf("satluj", "SE")).toBe(4);
    expect(floorCountOf("beas", "BW")).toBe(4);
    expect(floorCountOf("chenab", "CE")).toBe(4);
    expect(floorCountOf("raavi", "RC")).toBe(4);
    expect(floorCountOf("chintpurni", "CH")).toBe(3);
  });
  it("a room above the top floor of its wing is rejected", () => {
    // Satluj (rooms from 101): 4xx is the 3rd floor, the top one; 5xx would be a 4th floor
    expect(roomError("satluj", "499", "SE")).toBeNull();
    expect(roomError("satluj", "505", "SE")).toContain("only 4 floors");
    // Brahmaputra (rooms from 001): floor = room / 100, North 0-5, South 0-4
    expect(roomError("brahmaputra", "512", "BHN")).toBeNull();
    expect(roomError("brahmaputra", "612", "BHN")).toContain("only 6 floors");
    expect(roomError("brahmaputra", "412", "BHS")).toBeNull();
    expect(roomError("brahmaputra", "512", "BHS")).toContain("only 5 floors");
    // T6 (rooms from 101): floors 0-1
    expect(roomError("t6", "210", "D")).toBeNull();
    expect(roomError("t6", "310", "D")).toContain("only 2 floors");
  });
  it("without a wing only the numbering is checked", () => {
    expect(roomError("satluj", "905")).toBeNull();
  });
});

describe("Unit: which wings share cleaning slots", () => {
  it("every hostel except T6 has separate slots for each wing", () => {
    expect(slotGroupOf("satluj", "se")).toBe("SE");
    expect(slotGroupOf("satluj", "SW")).toBe("SW");
    expect(slotGroupOf("raavi", "RC")).toBe("RC");
    expect(slotGroupOf("brahmaputra", "BHN")).not.toBe(slotGroupOf("brahmaputra", "BHS"));
  });
  it("all T6 wings share one slot list", () => {
    expect(slotGroupOf("t6", "C")).toBe(slotGroupOf("t6", "G"));
  });
});
