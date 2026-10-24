import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
import { getToken } from "next-auth/jwt";
import { getDriveAccessToken } from "@/server/drive-token";

const req = new Request("http://localhost/api/swaps", { method: "POST" });
const inOneHour = Math.floor(Date.now() / 1000) + 3600;
const mockToken = (t: Record<string, unknown> | null) => vi.mocked(getToken).mockResolvedValue(t as never);

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret");
  vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Unit: the student's Drive token", () => {
  it("returns the token from the login cookie while it is still valid", async () => {
    mockToken({ driveGranted: true, driveAccessToken: "tok", driveExpiresAt: inOneHour });
    expect(await getDriveAccessToken(req)).toBe("tok");
  });

  it("gives null when the student never allowed Drive, or is not signed in", async () => {
    mockToken({ driveGranted: false, driveAccessToken: "tok", driveExpiresAt: inOneHour });
    expect(await getDriveAccessToken(req)).toBeNull();
    mockToken({ role: "Student" }); // signed in before Drive access was added
    expect(await getDriveAccessToken(req)).toBeNull();
    mockToken(null);
    expect(await getDriveAccessToken(req)).toBeNull();
  });

  it("renews an expired token with the refresh token", async () => {
    mockToken({ driveGranted: true, driveAccessToken: "old", driveExpiresAt: 1, driveRefreshToken: "refresh" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "fresh" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getDriveAccessToken(req)).toBe("fresh");
    const body = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=refresh");
  });

  it("gives null when it has expired and cannot be renewed", async () => {
    mockToken({ driveGranted: true, driveAccessToken: "old", driveExpiresAt: 1 }); // no refresh token
    expect(await getDriveAccessToken(req)).toBeNull();
    mockToken({ driveGranted: true, driveAccessToken: "old", driveExpiresAt: 1, driveRefreshToken: "revoked" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid_grant", { status: 400 })));
    expect(await getDriveAccessToken(req)).toBeNull();
  });
});
