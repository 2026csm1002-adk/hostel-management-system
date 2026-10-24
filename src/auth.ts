import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { resolveRole } from "@/server/services/auth.service";
import type { Role } from "@/types";

const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase() || null;

// The student's own Google Drive: swap documents are uploaded there with the student's own token.
// "drive.file" lets this app see only the files it creates itself, never the rest of their Drive.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Login proves WHO the person is (Google account). The `jwt` callback then looks the email up
// (staff list -> that role, anyone else -> Student) and keeps role/userId/hostelId in the token,
// so no database query is needed on every request.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Always show Google's account chooser, even if Chrome is already signed in.
      // No "hd" hint on purpose: it can make Google skip the chooser on phones.
      // The real institute-email check is the signIn callback below.
      // `access_type: offline` + `consent` make Google return a refresh token every time, so the
      // Drive token can be renewed later. The scope list must repeat the three basic ones.
      authorization: {
        params: {
          prompt: "select_account consent",
          access_type: "offline",
          scope: `openid email profile ${DRIVE_SCOPE}`,
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // The real security check: only institute emails may sign in.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = profile?.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;

      // A missing domain must never mean "everyone" in production.
      if (!allowedDomain) return process.env.NODE_ENV !== "production";
      return email.endsWith("@" + allowedDomain);
    },

    // `account` exists only at the moment of signing in. Tokens created before roles existed
    // have no role yet, so they are resolved here too.
    async jwt({ token, account, profile }) {
      // The Drive token is kept only in this (server-side) cookie, never in the session the browser sees.
      // src/server/drive-token.ts reads it and renews it when it has expired.
      if (account) {
        token.driveAccessToken = account.access_token;
        token.driveRefreshToken = account.refresh_token;
        token.driveExpiresAt = account.expires_at; // seconds since 1970
        // The student may untick the Drive permission on Google's screen.
        token.driveGranted = account.scope?.includes(DRIVE_SCOPE) ?? false;
      }
      if (account || !token.role) {
        const email = (profile?.email ?? token.email)?.toLowerCase();
        if (email) {
          const resolved = await resolveRole(email);
          token.role = resolved.role;
          token.userId = resolved.userId;
          token.hostelId = resolved.hostelId;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.role = (token.role ?? "Student") as Role;
      session.user.userId = (token.userId as string | null | undefined) ?? null;
      session.user.hostelId = (token.hostelId as string | null | undefined) ?? null;
      return session;
    },
  },
});
