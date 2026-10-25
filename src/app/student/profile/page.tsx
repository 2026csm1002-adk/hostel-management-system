import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfileForm } from "@/components/student/ProfileForm";
import { parseStudentEmail } from "@/lib/student-identity";
import { getGoogleName } from "@/server/google-name";

export default async function StudentProfilePage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const id = parseStudentEmail(email);

  // Saved values (hostel, wing, room, course) are loaded by the form from /api/profile.
  return (
    <ProfileForm
      identity={{
        // The Google name, exactly as Google gives it. Empty when Google has none: no placeholder is made up.
        name: (await getGoogleName()) ?? "",
        rollNo: id.rollNo,
        email: id.email,
        batch: id.batch,
      }}
    />
  );
}
