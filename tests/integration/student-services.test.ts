import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayISO } from "@/lib/dates";
import { profileSchema } from "@/lib/validators/profile.schema";
import { db } from "@/server/db/client";
import { attachment, cleaningBooking, complaint, swapRequest } from "@/server/db/schema";
import { cleaningService } from "@/server/services/cleaning.service";
import { complaintService } from "@/server/services/complaint.service";
import { profileService } from "@/server/services/profile.service";
import { swapService } from "@/server/services/swap.service";
import { resetDb } from "../helpers";

const profile = (n: number, room = "207") => ({
  fullName: `Student ${n}`, hostelId: "satluj", wing: "se", roomNo: room, course: "MTech" as const,
  mobileNo: "9876543210",
});
const email = (n: number) => `2026csm10${String(n).padStart(2, "0")}@iitrpr.ac.in`;
const date = () => addDays(todayISO(), 2);

const setComplaint = (id: string, patch: Partial<typeof complaint.$inferInsert>) =>
  db.update(complaint).set(patch).where(eq(complaint.complaintId, id));
const setSwapStatus = (id: string, status: string) =>
  db.update(swapRequest).set({ status }).where(eq(swapRequest.swapId, id));
const allSwaps = () => db.select().from(swapRequest);

describe("Integration: student services (test database)", () => {
  beforeEach(() => resetDb());

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

    // Four students click at the same moment. The database never gives out more than 3 seats and never the same seat twice;
    // a student who loses a seat race may simply try again.
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((n) => cleaningService.bookSlot(email(n), { date: date(), slotStart: "09:00" })),
    );
    expect(results.filter((r) => r.status === "fulfilled").length).toBeLessThanOrEqual(3);
    let lastError = "";
    for (const [i, r] of results.entries()) {
      if (r.status === "fulfilled") continue;
      try {
        await cleaningService.bookSlot(email(i + 1), { date: date(), slotStart: "09:00" });
      } catch (e) {
        lastError = (e as Error).message;
      }
    }
    expect(lastError).toMatch(/full/i); // exactly one student is left without a seat, and is told the slot is full
    const taken = await db.select().from(cleaningBooking);
    expect(taken.map((b) => b.seat).sort()).toEqual([1, 2, 3]);

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

  // Seats are counted per floor of each wing (T6: all wings share), so the slot list and the real limit agree.
  it("cleaning: a slot that is listed as Available can always be booked, also by the other wing of the hostel", async () => {
    // Satluj SE: three students fill the 9:00 slot of the 1st floor
    for (let n = 1; n <= 3; n++) await profileService.upsertProfile(email(n), profile(n, `20${n}`));
    for (let n = 1; n <= 3; n++) await cleaningService.bookSlot(email(n), { date: date(), slotStart: "09:00" });

    // Satluj SW, same floor: whatever the list says must be true when the student presses Book
    await profileService.upsertProfile(email(4), { ...profile(4, "204"), wing: "sw" });
    const listed = (await cleaningService.getAvailability(email(4), date()))[0];
    const outcome = await cleaningService
      .bookSlot(email(4), { date: date(), slotStart: "09:00" })
      .then(() => "booked", (e: Error) => (/full/i.test(e.message) ? "full" : e.message));
    expect(outcome).toBe(listed.status === "Available" ? "booked" : "full");

    // ...and a further SE student on that floor never gets past 3 seats of the SE slot
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

  // Two clicks at the same moment can both pass the "already booked today?" check, because the database has no
  // unique rule on (student, date). One click after the other is refused (see the test above). To turn this into a
  // real test, add a unique index on cleaning_booking (student_id, booking_date).
  it.todo("cleaning: two simultaneous clicks for different slots on one day give only one booking");

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

    const backDate = new Date(Date.now() - 8 * 86_400_000).toISOString();
    await setComplaint(c.id, { createdAt: backDate });
    expect((await complaintService.listMine(email(1)))[0].canReregister).toBe(true);
    const fresh = await complaintService.reregister(email(1), c.id);
    expect(fresh.reregisteredFrom).toBe(c.id);
    expect(fresh.id).not.toBe(c.id); // a new ticket ...
    expect(fresh.status).toBe("Open");
    expect(fresh.createdAt).toBe(backDate); // ... with the old (back) date
    expect(fresh.daysOld).toBeGreaterThanOrEqual(8);
    expect(fresh.canReregister).toBe(false); // it is old already, but it cannot be re-registered again
    await expect(complaintService.reregister(email(1), fresh.id)).rejects.toThrow(/already a re-registered/);
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
    const [saved] = await db.select().from(complaint).where(eq(complaint.complaintId, c.id));
    expect(saved.resolvedAt).not.toBeNull();
    expect((await complaintService.listMine(email(1)))[0].status).toBe("Resolved");

    await expect(complaintService.markResolved(email(1), c.id)).rejects.toThrow(/already resolved/);
    await expect(complaintService.markResolved(email(1), "no-such-id")).rejects.toThrow(/not found/i);
  });

  it("complaints: resolving a re-registered complaint closes the older tickets too", async () => {
    await profileService.upsertProfile(email(1), profile(1));
    const old = await complaintService.create(email(1), { category: "Electrical", description: "Fan broken" });
    await setComplaint(old.id, { createdAt: new Date(Date.now() - 8 * 86_400_000).toISOString() });
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
    await setSwapStatus(plain.id, "Rejected"); // one request at a time: the next one needs the first to be finished

    const pdf = new File(["x"], "certificate.pdf", { type: "application/pdf" });
    const withFile = await swapService.submit(email(1), { reason: "Medical reason" }, pdf);
    expect(withFile.attachmentName).toBe("certificate.pdf");
    expect(withFile.attachmentUrl).toBeNull(); // no Drive in tests: the file gets a fake dev id, so there is no link
    await setSwapStatus(withFile.id, "RoomAssigned");

    await expect(
      swapService.submit(email(1), { reason: "Medical reason" }, new File(["x"], "a.exe", { type: "application/x-msdownload" })),
    ).rejects.toThrow(/PDF, JPG or PNG/);
    expect(await swapService.listMine(email(1))).toHaveLength(2);
  });

  it("swap: only one open request at a time, until it is rejected or a room is assigned", async () => {
    await profileService.upsertProfile(email(1), profile(1));
    await profileService.upsertProfile(email(2), profile(2));
    const first = await swapService.submit(email(1), { reason: "Need a quieter room" });

    // every status except Rejected / RoomAssigned blocks a new request
    for (const status of ["Pending", "Forwarded", "Accepted", "Waiting", "AwaitingRoom"]) {
      await setSwapStatus(first.id, status);
      await expect(swapService.submit(email(1), { reason: "Another reason" })).rejects.toThrow(/already have a room swap request/);
    }
    expect(await swapService.listMine(email(1))).toHaveLength(1);

    // another student is not affected
    await expect(swapService.submit(email(2), { reason: "My own reason" })).resolves.toMatchObject({ status: "Pending" });

    // a rejected request, or one that got its room, lets the student ask again
    for (const status of ["Rejected", "RoomAssigned"]) {
      await setSwapStatus(first.id, status);
      const next = await swapService.submit(email(1), { reason: `Asking again after ${status}` });
      expect(next.status).toBe("Pending");
      await setSwapStatus(next.id, "Rejected"); // finish it for the next round
    }

    // a refused request leaves nothing behind (no file uploaded, no row)
    const count = (await allSwaps()).length;
    await setSwapStatus(first.id, "Pending");
    await expect(
      swapService.submit(email(1), { reason: "With a file" }, new File(["x"], "a.pdf", { type: "application/pdf" })),
    ).rejects.toThrow(/already have a room swap request/);
    expect(await allSwaps()).toHaveLength(count);
    expect(await db.select().from(attachment)).toHaveLength(0);
  });
});
