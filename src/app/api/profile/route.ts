import { profileSchema } from "@/lib/validators/profile.schema";
import { requireStudentEmail, respond } from "@/server/api-helpers";
import { getGoogleName } from "@/server/google-name";
import { profileService } from "@/server/services/profile.service";

export function GET() {
  return respond(async () => {
    const email = await requireStudentEmail();
    // Every time the profile is loaded the saved name is checked against the Google account.
    await profileService.syncNameFromGoogle(email, await getGoogleName());
    return { profile: await profileService.getProfile(email) };
  });
}

export function PUT(req: Request) {
  return respond(async () => {
    const email = await requireStudentEmail();
    const data = profileSchema.parse(await req.json());
    return { profile: await profileService.upsertProfile(email, data, await getGoogleName()) };
  });
}
