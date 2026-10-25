import { auth } from "@/auth";

/** The name on the signed-in student's Google account, tidied up, or null when Google gave none. Never made up. */
export async function getGoogleName(): Promise<string | null> {
  const session = await auth();
  const name = session?.user?.name?.replace(/\s+/g, " ").trim();
  return name && !name.includes("@") ? name : null;
}
