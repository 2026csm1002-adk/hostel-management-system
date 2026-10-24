import { describe, it, expect, vi, afterEach } from "vitest";
import { fileStorage } from "@/server/storage/file-storage.client";

const pdf = () => new File(["PDFDATA"], "C:\\fakepath\\proof.pdf", { type: "application/pdf" });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Unit: document storage", () => {
  it("builds the Google Drive link from the stored file id", () => {
    expect(fileStorage.viewUrl("1AbC_dEf-123")).toBe("https://drive.google.com/file/d/1AbC_dEf-123/view");
  });

  it("gives no link for a file that was never uploaded (dev id)", () => {
    expect(fileStorage.viewUrl("dev-1234")).toBeNull();
  });

  it("does not call Google in tests: the upload returns a dev id", async () => {
    expect((await fileStorage.upload(pdf(), null)).storageFileId.startsWith("dev-")).toBe(true);
  });

  it("uploads to the student's own Drive with the student's token, in the app folder, and shares it", async () => {
    vi.stubEnv("VITEST", "");
    const calls: { url: string; auth: string | null; method: string; body?: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const headers = init.headers as Record<string, string>;
        calls.push({ url, auth: headers.Authorization ?? null, method: init.method ?? "GET", body: init.body });
        if (url.includes("/upload/drive")) return new Response(JSON.stringify({ id: "FILE1" }));
        if (url.includes("q=")) return new Response(JSON.stringify({ files: [] })); // no folder yet
        if (url.includes("/permissions")) return new Response("{}");
        return new Response(JSON.stringify({ id: "FOLDER1" })); // folder created
      }),
    );

    const result = await fileStorage.upload(pdf(), "student-token");

    expect(result.storageFileId).toBe("FILE1");
    expect(calls.every((c) => c.auth === "Bearer student-token")).toBe(true); // never anyone else's account
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "POST", "POST"]); // find folder, make it, upload, share
    const uploadBody = await (calls[2].body as Blob).text();
    expect(uploadBody).toContain('"parents":["FOLDER1"]');
    expect(uploadBody).toMatch(/"name":"\d{4}-\d{2}-\d{2}-proof\.pdf"/);
    expect(uploadBody).toContain("PDFDATA");
    expect(JSON.parse(calls[3].body as string)).toEqual({ role: "reader", type: "domain", domain: "iitrpr.ac.in" });
  });

  it("asks the student to sign in again when there is no token or the token is refused", async () => {
    vi.stubEnv("VITEST", "");
    await expect(fileStorage.upload(pdf(), null)).rejects.toThrow(/sign in again/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Invalid Credentials", { status: 401 })));
    await expect(fileStorage.upload(pdf(), "expired")).rejects.toThrow(/sign in again/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"status":"ACCESS_TOKEN_SCOPE_INSUFFICIENT"}}', { status: 403 })));
    await expect(fileStorage.upload(pdf(), "no-drive-scope")).rejects.toThrow(/sign in again/);
  });

  it("says plainly when the Drive API is not switched on or the institute blocks the app", async () => {
    vi.stubEnv("VITEST", "");
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"errors":[{"reason":"accessNotConfigured"}]}}', { status: 403 })));
    await expect(fileStorage.upload(pdf(), "tok")).rejects.toThrow(/not switched on/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden by admin", { status: 403 })));
    await expect(fileStorage.upload(pdf(), "tok")).rejects.toThrow(/may block this app/);
  });
});
