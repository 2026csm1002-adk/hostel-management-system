import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayISO } from "@/lib/dates";
import { profileSchema } from "@/lib/validators/profile.schema";
import { memory, resetMemoryStore } from "@/server/db/memory-store";
import { cleaningService } from "@/server/services/cleaning.service";
import { complaintService } from "@/server/services/complaint.service";
import { profileService } from "@/server/services/profile.service";
import { swapService } from "@/server/services/swap.service";

const profile = (n: number, room = "207") => ({
  fullName: `Student ${n}`, hostelId: "satluj", wing: "se", roomNo: room, course: "MTech" as const,
  mobileNo: "9876543210",
});
const email = (n: number) => `2026csm10${String(n).padStart(2, "0")}@iitrpr.ac.in`;
const date = () => addDays(todayISO(), 2);

describe("Integration: student services (in-memory store)", () => {
  beforeEach(resetMemoryStore);

  it("profile: derives floor, keeps roll no read-only, rejects bad rooms", async () => {
    const p = await profileService.upsertProfile(email(1), profile(1, "105"));
    expect(p.studentId).toBe("2026CSM1001");
    expect(p.floor).toBe(0);
    expect(p.floorLabel).toBe("Ground floor");
    expect(p.wing).toBe("SE");
    const again = await profileService.upsertProfile(email(1), { ...profile(1, "309"), rollNo: "HACKED0001" });
    expect(again.studentId).toBe("2026CSM1001");
    expect(again.floor).toBe(2);
    await expect(profileService.upsertProfile(email(2), profile(2, "45"))).rejects.toThrow();
  });

  it("profile: the wing must belong to the hostel (any letter case is accepted)", async () => {
    await expect(
      profileService.upsertProfile(email(1), { ...profile(1), hostelId: "beas", wing: "SE" }),
    ).rejects.toThrow(/BE, BW/);
    const ok = await profileService.upsertProfile(email(1), { ...profile(1), hostelId: "beas", wing: "bw" });
    expect(ok).toMatchObject({ hostelId: "beas", wing: "BW" });
  });

  it("profile: Raavi, Brahmaputra and Chintpurni number rooms from 001", async () => {
    const raavi = (n: number, room: string) =>
      profileService.upsertProfile(email(n), { ...profile(n, room), hostelId: "raavi", wing: "RC" });
    expect((await raavi(1, "001")).floorLabel).toBe("Ground floor");
    expect((await raavi(2, "101")).floorLabel).toBe("1st floor");
    expect((await raavi(3, "207")).floorLabel).toBe("2nd floor");
    await expect(raavi(4, "000")).rejects.toThrow(/Raavi/);
    // the same room number is one floor lower in a hostel that starts at 101
    expect((await profileService.upsertProfile(email(5), profile(5, "207"))).floorLabel).toBe("1st floor");
  });

  it("profile: saved only when every detail is filled, mobile number stored as 10 digits", async () => {
    await expect(profileService.upsertProfile(email(1), { ...profile(1), mobileNo: "" })).rejects.toThrow(/mobile/i);
    await expect(profileService.upsertProfile(email(1), { ...profile(1), mobileNo: "12345" })).rejects.toThrow(/10-digit/);
    await expect(profileService.upsertProfile(email(1), { ...profile(1), fullName: " " })).rejects.toThrow(/name/i);
    const ok = await profileService.upsertProfile(email(1), { ...profile(1), mobileNo: "+91 98765-43210" });
    expect(ok.mobileNo).toBe("9876543210");
    expect((await profileService.getProfile(email(1)))?.mobileNo).toBe("9876543210");
  });

  it("profile form rules: every field is required, including the mobile number", () => {
    const base = { ...profile(1), hostelId: "chintpurni", wing: "CH", roomNo: "012" };
    expect(profileSchema.safeParse(base).success).toBe(true);
    for (const field of ["fullName", "hostelId", "wing", "roomNo", "course", "mobileNo"] as const) {
      expect(profileSchema.safeParse({ ...base, [field]: "" }).success).toBe(false);
    }
    const { mobileNo: _omit, ...withoutMobile } = base;
    expect(profileSchema.safeParse(withoutMobile).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, mobileNo: "5876543210" }).success).toBe(false);
    const parsed = profileSchema.parse({ ...base, mobileNo: "98765 43210" });
    expect(parsed.mobileNo).toBe("9876543210");
  });

  it("profile form rules reject a wing or room that does not fit the hostel", () => {
    const base = { ...profile(1), hostelId: "chintpurni", wing: "CH", roomNo: "012" };
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, wing: "SE" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, hostelId: "satluj", wing: "SE", roomNo: "012" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, hostelId: "nowhere" }).success).toBe(false);
  });

  it("cleaning: a ground-floor room 012 in Chintpurni books on floor 0", async () => {
    await profileService.upsertProfile(email(1), { ...profile(1, "012"), hostelId: "chintpurni", wing: "CH" });
    const booking = await cleaningService.bookSlot(email(1), { date: date(), slotStart: "09:00" });
    expect(booking).toMatchObject({ floor: 0, floorLabel: "Ground floor", roomNo: "012" });
  });

  it("everything needs a profile first", async () => {
    await expect(complaintService.create(email(9), { category: "Plumbing", description: "x" })).rejects.toThrow(/profile/i);
    expect(await cleaningService.listMine(email(9))).toEqual([]);
  });

  it("cleaning: window, seats 1-3, fourth student gets 'full', same room cannot double-book", async () => {
    for (let n = 1; n <= 4; n++) await profileService.upsertProfile(email(n), profile(n, `20${n}`));
    await expect(cleaningService.bookSlot(email(1), { date: todayISO(), slotStart: "09:00" })).rejects.toThrow(/next 3 days/);

    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((n) => cleaningService.bookSlot(email(n), { date: date(), slotStart: "09:00" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const seats = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.seat] : [])).sort();
    expect(seats).toEqual([1, 2, 3]);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toMatch(/full/i);

    const slots = await cleaningService.getAvailability(email(1), date());
    expect(slots[0]).toMatchObject({ filled: 3, status: "Full" });
    await expect(cleaningService.bookSlot(email(1), { date: date(), slotStart: "09:00" })).rejects.toThrow(/already/);
  });

  it("cleaning: different floors have separate capacity", async () => {
    await profileService.upsertProfile(email(1), profile(1, "105")); // ground
    await profileService.upsertProfile(email(2), profile(2, "305")); // 2nd
    await cleaningService.bookSlot(email(1), { date: date(), slotStart: "10:00" });
    const slots = await cleaningService.getAvailability(email(2), date());
    expect(slots[1].filled).toBe(0);
  });

  it("cleaning: the two wings of a hostel have separate slots", async () => {
    // Satluj SE: three students fill the 9:00 slot of the 1st floor
    for (let n = 1; n <= 3; n++) await profileService.upsertProfile(email(n), profile(n, `20${n}`));
    for (let n = 1; n <= 3; n++) await cleaningService.bookSlot(email(n), { date: date(), slotStart: "09:00" });
    // Satluj SW, same floor: its own slot is still empty and can be booked
    await profileService.upsertProfile(email(4), { ...profile(4, "204"), wing: "sw" });
    expect((await cleaningService.getAvailability(email(4), date()))[0]).toMatchObject({ filled: 0, status: "Available" });
    await expect(cleaningService.bookSlot(email(4), { date: date(), slotStart: "09:00" })).resolves.toMatchObject({ seat: 1 });
    // ...and a fourth SE student still finds the SE slot full
    await profileService.upsertProfile(email(5), profile(5, "205"));
    await expect(cleaningService.bookSlot(email(5), { date: date(), slotStart: "09:00" })).rejects.toThrow(/full/i);
  });

  it("cleaning: a person can book only one slot per day", async () => {
    await profileService.upsertProfile(email(1), profile(1, "201"));
    await cleaningService.bookSlot(email(1), { date: date(), slotStart: "09:00" });
    // another slot on the same day is refused, with a clear message
    await expect(cleaningService.bookSlot(email(1), { date: date(), slotStart: "10:00" })).rejects.toThrow(/one slot can be booked per day/);
    // and the other slots of that day are closed in the slot list
    const slots = await cleaningService.getAvailability(email(1), date());
    expect(slots.every((s) => s.dayBooked)).toBe(true);
    // a different day is still open
    const other = addDays(todayISO(), 3);
    expect((await cleaningService.getAvailability(email(1), other)).some((s) => s.dayBooked)).toBe(false);
    await expect(cleaningService.bookSlot(email(1), { date: other, slotStart: "10:00" })).resolves.toMatchObject({ date: other });
    expect(await cleaningService.listMine(email(1))).toHaveLength(2);
  });

  it("cleaning: two quick clicks for different slots on one day give only one booking", async () => {
    await profileService.upsertProfile(email(1), profile(1, "201"));
    const results = await Promise.allSettled([
      cleaningService.bookSlot(email(1), { date: date(), slotStart: "09:00" }),
      cleaningService.bookSlot(email(1), { date: date(), slotStart: "10:00" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await cleaningService.listMine(email(1))).toHaveLength(1);
  });

  it("cleaning: all wings of T6 share one slot list", async () => {
    const t6 = (n: number, wing: string, room: string) =>
      profileService.upsertProfile(email(n), { ...profile(n, room), hostelId: "t6", wing });
    await t6(1, "C", "105");
    await t6(2, "D", "106");
    await t6(3, "E", "107");
    await t6(4, "F", "108");
    for (const n of [1, 2, 3]) await cleaningService.bookSlot(email(n), { date: date(), slotStart: "09:00" });
    // wing F sees the seats taken by wings C, D and E
    expect((await cleaningService.getAvailability(email(4), date()))[0]).toMatchObject({ filled: 3, status: "Full" });
    await expect(cleaningService.bookSlot(email(4), { date: date(), slotStart: "09:00" })).rejects.toThrow(/full/i);
  });

  it("complaints: create, list, re-register rules", async () => {
    await profileService.upsertProfile(email(1), profile(1));
    const c = await complaintService.create(email(1), { category: "Electrical", description: "Fan broken" });
    expect(c.status).toBe("Open");
    await expect(complaintService.reregister(email(1), c.id)).rejects.toThrow(/7 days/);

    memory.complaints[0].createdAt = new Date(Date.now() - 8 * 86_400_000).toISOString();
    expect((await complaintService.listMine(email(1)))[0].canReregister).toBe(true);
    const fresh = await complaintService.reregister(email(1), c.id);
    expect(fresh.reregisteredFrom).toBe(c.id);
    await expect(complaintService.reregister(email(1), c.id)).rejects.toThrow(/already/);

    const list = await complaintService.listMine(email(1));
    expect(list.find((x) => x.id === c.id)?.reregistered).toBe(true);

    await profileService.upsertProfile(email(2), profile(2));
    await expect(complaintService.reregister(email(2), c.id)).rejects.toThrow(/not found/i);
  });

  it("complaints: the student can mark their own complaint as resolved", async () => {
    await profileService.upsertProfile(email(1), profile(1));
    const c = await complaintService.create(email(1), { category: "Plumbing", description: "Tap leaks" });

    // another student cannot resolve it
    await profileService.upsertProfile(email(2), profile(2));
    await expect(complaintService.markResolved(email(2), c.id)).rejects.toThrow(/not found/i);

    const done = await complaintService.markResolved(email(1), c.id);
    expect(done.status).toBe("Resolved");
    expect(done.canReregister).toBe(false);
    expect(memory.complaints[0].resolvedAt).not.toBeNull();
    expect((await complaintService.listMine(email(1)))[0].status).toBe("Resolved");

    await expect(complaintService.markResolved(email(1), c.id)).rejects.toThrow(/already resolved/);
    await expect(complaintService.markResolved(email(1), "no-such-id")).rejects.toThrow(/not found/i);
  });

  it("complaints: resolving a re-registered complaint closes the older tickets too", async () => {
    await profileService.upsertProfile(email(1), profile(1));
    const old = await complaintService.create(email(1), { category: "Electrical", description: "Fan broken" });
    memory.complaints[0].createdAt = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const fresh = await complaintService.reregister(email(1), old.id);

    // the old ticket was replaced: only the newer one can be resolved
    await expect(complaintService.markResolved(email(1), old.id)).rejects.toThrow(/newer ticket/);
    await complaintService.markResolved(email(1), fresh.id);

    const list = await complaintService.listMine(email(1));
    expect(list.every((x) => x.status === "Resolved")).toBe(true);
  });

  it("swap: submits as Pending with optional attachment; rejects bad files", async () => {
    await profileService.upsertProfile(email(1), profile(1));
    const plain = await swapService.submit(email(1), { reason: "Need a quieter room" });
    expect(plain).toMatchObject({ status: "Pending", attachmentName: null, attachmentUrl: null });

    const pdf = new File(["x"], "certificate.pdf", { type: "application/pdf" });
    const withFile = await swapService.submit(email(1), { reason: "Medical reason" }, pdf);
    expect(withFile.attachmentName).toBe("certificate.pdf");
    expect(withFile.attachmentUrl).toBeNull(); // no Drive in tests: the file gets a fake dev id, so there is no link

    await expect(
      swapService.submit(email(1), { reason: "Medical reason" }, new File(["x"], "a.exe", { type: "application/x-msdownload" })),
    ).rejects.toThrow(/PDF, JPG or PNG/);
    expect(await swapService.listMine(email(1))).toHaveLength(2);
  });
});
