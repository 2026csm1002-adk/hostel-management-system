import { randomUUID } from "node:crypto";
import { AppError } from "@/server/errors";

// Documents (room swap proofs) are uploaded to the STUDENT'S OWN Google Drive, using the Google access
// token the student gave when signing in (the "drive.file" permission: this app can only see the files
// it creates itself). They are put in a folder called "Hostel Management System" in the student's Drive.
//
// The database keeps only the Drive file id (the `storage_file_id` column of `attachment`); viewUrl()
// builds the link from it, so anyone allowed to see the request can open the document.
//
// After the upload the file is shared so that staff can open the link:
//   GOOGLE_DRIVE_SHARE         "domain" (default: everyone signed in with the institute account who has the link),
//                              "anyone" (everyone who has the link) or "none" (only the student)
//   GOOGLE_DRIVE_SHARE_DOMAIN  default "iitrpr.ac.in"
//   DRIVE_UPLOADS=off          nothing is uploaded: a fake id "dev-..." is stored (useful on a computer with no Google
//                              sign-in set up). Always the case in tests.

const FOLDER_NAME = "Hostel Management System";
const API = "https://www.googleapis.com";
const SIGN_IN_AGAIN = "Please sign out and sign in again, and allow access to Google Drive, to upload documents.";

async function drive(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    console.error("[drive] Google refused the request:", res.status, text);
    if (/accessNotConfigured|SERVICE_DISABLED|has not been used in project|API has not been enabled/i.test(text)) {
      throw new AppError("Google Drive is not switched on for this project yet. Please tell the administrator.", 503);
    }
    if (res.status === 401 || /insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|invalid_token|Invalid Credentials/i.test(text)) {
      throw new AppError(SIGN_IN_AGAIN, 401);
    }
    throw new AppError("Google Drive refused the upload (the institute may block this app). Please tell the administrator.", 403);
  }
  return res;
}

/** The app's folder in the student's Drive (created the first time). */
async function folderId(token: string): Promise<string> {
  const q = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await drive(token, `${API}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
  if (found.ok) {
    const { files } = (await found.json()) as { files?: { id: string }[] };
    if (files && files.length > 0) return files[0].id;
  }
  const created = await drive(token, `${API}/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!created.ok) {
    console.error("[drive] could not create the folder:", created.status, await created.text());
    throw new AppError("Could not upload the document. Please try again.", 502);
  }
  return ((await created.json()) as { id: string }).id;
}

/** Lets staff open the file with its link, as set by GOOGLE_DRIVE_SHARE. A failure here is logged, the upload stays. */
async function share(fileId: string, token: string) {
  const mode = process.env.GOOGLE_DRIVE_SHARE ?? "domain";
  if (mode === "none") return;
  const permission =
    mode === "anyone"
      ? { role: "reader", type: "anyone" }
      : { role: "reader", type: "domain", domain: process.env.GOOGLE_DRIVE_SHARE_DOMAIN ?? "iitrpr.ac.in" };
  try {
    const res = await drive(token, `${API}/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permission),
    });
    if (!res.ok) console.error("[drive] could not share the file:", res.status, await res.text());
  } catch (e) {
    console.error("[drive] could not share the file:", e);
  }
}

export const fileStorage = {
  /** Stores the file in the student's Drive (using their access token) and returns the id to keep in the database. */
  async upload(file: File, accessToken: string | null): Promise<{ storageFileId: string }> {
    if (process.env.VITEST || process.env.DRIVE_UPLOADS === "off") return { storageFileId: `dev-${randomUUID()}` };
    if (!accessToken) {
      console.error("[drive] no Drive token for this student (see the [drive] line above for the reason)");
      throw new AppError(SIGN_IN_AGAIN, 401);
    }

    const parent = await folderId(accessToken);
    const boundary = `hms-${randomUUID()}`;
    const metadata = JSON.stringify({
      name: `${new Date().toISOString().slice(0, 10)}-${file.name.split(/[\\/]/).pop()}`.slice(0, 150),
      parents: [parent],
    });
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
      await file.arrayBuffer(),
      `\r\n--${boundary}--`,
    ]);

    const res = await drive(accessToken, `${API}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) {
      console.error("[drive] upload failed:", res.status, await res.text());
      throw new AppError("Could not upload the document. Please try again.", 502);
    }
    const { id } = (await res.json()) as { id: string };
    await share(id, accessToken);
    return { storageFileId: id };
  },

  /** The link that opens the document in Google Drive, or null for a file that was never uploaded (dev ids). */
  viewUrl(storageFileId: string): string | null {
    return storageFileId.startsWith("dev-") ? null : `https://drive.google.com/file/d/${storageFileId}/view`;
  },
};
