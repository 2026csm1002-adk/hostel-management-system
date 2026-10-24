import { getToken } from "next-auth/jwt";

// The signed-in student's Google Drive access token, read from their login cookie (see src/auth.ts).
// It never goes to the browser. An access token lasts about an hour, so when it has expired a new one is
// asked from Google with the refresh token that is kept in the same cookie.
//
// Returns null when the student has no usable Drive permission: they signed in before Drive access was
// added, or unticked it on Google's screen, or Google refused the refresh. They must sign in again.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

function why(reason: string): null {
  console.error(`[drive] no usable Drive token: ${reason}`);
  return null;
}

export async function getDriveAccessToken(req: Request): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return why("AUTH_SECRET is not set");

  let jwt: Awaited<ReturnType<typeof getToken>>;
  try {
    jwt = await getToken({ req, secret });
  } catch (e) {
    return why(`the login cookie could not be read (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!jwt) return why("the login cookie could not be read (not signed in, or the cookie name / secret does not match)");
  if (jwt.driveGranted !== true) {
    return why(`the login has no Drive permission (driveGranted=${String(jwt.driveGranted)}): sign out and sign in again`);
  }

  const accessToken = typeof jwt.driveAccessToken === "string" ? jwt.driveAccessToken : null;
  const expiresAt = typeof jwt.driveExpiresAt === "number" ? jwt.driveExpiresAt : 0;
  if (accessToken && expiresAt * 1000 > Date.now() + 60_000) return accessToken;

  const refreshToken = typeof jwt.driveRefreshToken === "string" ? jwt.driveRefreshToken : null;
  if (!refreshToken) return why("the Drive token has expired and Google gave no refresh token at sign-in");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    return why(`Google would not renew the token (${res.status} ${await res.text()})`);
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}
