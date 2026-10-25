"use client";

import { useState } from "react";
import { COURSES, HOSTELS } from "@/lib/constants";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { wingsOf } from "@/lib/hostels";
import { normalizeMobile } from "@/lib/mobile";
import { floorFromRoom, floorLabel } from "@/lib/room";
import type { StudentProfile } from "@/types";
import { useProfile } from "./useProfile";

export type ProfileIdentity = {
  name: string;           // best name guess (Google name / email)
  rollNo: string | null;  // from the email, null when the email has none
  email: string;
  batch: string | null;
};

const inputClass =
  "w-full rounded-[3px] border border-line-strong bg-white px-[11px] py-[9px] disabled:bg-paper disabled:text-ink-soft";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-semibold">{label}</label>
      {children}
    </div>
  );
}

function ReadOnly({ value, placeholder = "—" }: { value: string; placeholder?: string }) {
  return (
    <input type="text" readOnly disabled value={value} placeholder={placeholder} className={inputClass} />
  );
}

export function ProfileForm({ identity }: { identity: ProfileIdentity }) {
  const { profile, loading, error, setProfile } = useProfile();
  if (loading) return <p className="text-sm text-ink-soft">Loading your profile…</p>;
  if (error) return <p className="text-sm text-brick">{error}</p>;
  return <ProfileFields identity={identity} profile={profile} onSaved={setProfile} />;
}

function ProfileFields({
  identity,
  profile,
  onSaved,
}: {
  identity: ProfileIdentity;
  profile: StudentProfile | null;
  onSaved: (p: StudentProfile) => void;
}) {
  // The name comes from the Google account and cannot be edited. Only when Google has no name for the
  // account, the student types it once (an old "Student 18" placeholder counts as no name).
  const googleName = identity.name.trim();
  const [typedName, setTypedName] = useState(
    googleName || /^Student \d+$/i.test(profile?.fullName ?? "") ? "" : (profile?.fullName ?? ""),
  );
  const fullName = googleName || typedName;
  const [hostelId, setHostelId] = useState(profile?.hostelId ?? "");
  const [wing, setWing] = useState(profile?.wing ?? "");
  const [roomNo, setRoomNo] = useState(profile?.roomNo ?? "");
  const [course, setCourse] = useState<string>(profile?.course ?? "");
  const [rollNo, setRollNo] = useState(identity.rollNo ?? "");
  const [batch, setBatch] = useState(identity.batch ?? "");
  const [mobileNo, setMobileNo] = useState(profile?.mobileNo ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Roll no / batch are typed only when the email does not contain them (and never after the first save).
  const rollEditable = !profile && !identity.rollNo;
  const batchEditable = !profile && !identity.batch;
  const wings = wingsOf(hostelId);
  const floor = floorFromRoom(roomNo, hostelId);

  // Each hostel has its own wings. Changing hostel clears a wing that does not exist there,
  // and a hostel with a single wing (for example Chintpurni) is filled in automatically.
  function chooseHostel(id: string) {
    setHostelId(id);
    const options = wingsOf(id);
    setWing((current) => (options.includes(current) ? current : options.length === 1 ? options[0] : ""));
  }

  // The profile is saved only when every detail is filled in.
  const missing = [
    !fullName.trim() && "Full name",
    rollEditable && !rollNo.trim() && "Roll No",
    batchEditable && !batch.trim() && "Batch",
    !hostelId && "Hostel",
    !wing && "Wing",
    !roomNo.trim() && "Room number",
    !course && "Course",
    !mobileNo.trim() ? "Mobile number" : normalizeMobile(mobileNo) === null && "A valid 10-digit mobile number",
  ].filter((m): m is string => typeof m === "string");

  async function save() {
    if (missing.length > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ profile: StudentProfile }>("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          hostelId,
          wing,
          roomNo,
          course,
          mobileNo,
          ...(rollEditable ? { rollNo } : {}),
          ...(batchEditable ? { batch } : {}),
        }),
      });
      onSaved(data.profile);
      setMessage({ ok: true, text: "Profile saved." });
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[3px] border border-line bg-white p-[18px]">
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Full name">
          {googleName ? (
            <ReadOnly value={googleName} />
          ) : (
            <input
              className={inputClass}
              value={typedName}
              placeholder="Your full name"
              onChange={(e) => setTypedName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Roll No">
          {rollEditable ? (
            <input className={inputClass} value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
          ) : (
            <ReadOnly value={profile?.studentId ?? identity.rollNo ?? ""} />
          )}
        </Field>
        <Field label="Institute email">
          <ReadOnly value={identity.email} />
        </Field>
        <Field label="Batch">
          {batchEditable ? (
            <input className={inputClass} value={batch} placeholder="e.g. 2026" onChange={(e) => setBatch(e.target.value)} />
          ) : (
            <ReadOnly value={profile?.batch ?? identity.batch ?? ""} />
          )}
        </Field>
        <Field label="Hostel">
          <select className={inputClass} value={hostelId} onChange={(e) => chooseHostel(e.target.value)}>
            <option value="">Select hostel</option>
            {(["Boys", "Girls"] as const).map((type) => (
              <optgroup key={type} label={`${type}' hostels`}>
                {HOSTELS.filter((h) => h.type === type).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Wing">
          <select
            className={inputClass}
            value={wing}
            disabled={!hostelId}
            onChange={(e) => setWing(e.target.value)}
          >
            <option value="">{hostelId ? "Select wing" : "Select hostel first"}</option>
            {wings.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room number">
          <input
            className={inputClass}
            value={roomNo}
            placeholder={hostelId ? "e.g. 207" : "Select hostel first"}
            onChange={(e) => setRoomNo(e.target.value)}
          />
        </Field>
        <Field label="Floor (from room number)">
          <ReadOnly value={floor === null ? "" : floorLabel(floor)} placeholder="Enter a valid room number" />
        </Field>
        <Field label="Course">
          <select className={inputClass} value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Select course</option>
            {COURSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mobile number">
          <input
            className={inputClass}
            type="tel"
            inputMode="numeric"
            value={mobileNo}
            placeholder="10-digit mobile number"
            onChange={(e) => setMobileNo(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || missing.length > 0}
          className="rounded-[3px] bg-teal px-[18px] py-2.5 font-display text-[13.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
        {missing.length > 0 && (
          <span className="text-[12.5px] text-ink-soft">Fill in all the details to save: {missing.join(", ")}.</span>
        )}
        {message && (
          <span role="status" className={"text-[12.5px] " + (message.ok ? "text-green" : "text-brick")}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
