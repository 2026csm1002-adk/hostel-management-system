"use client";

import { useEffect } from "react";
import { NewTag } from "@/components/caretaker/NewTag";
import { useApi } from "@/components/shared/useApi";
import type { StaffComplaintDTO } from "@/types/caretaker";

const REFRESH_MS = 30_000; // look for new items every 30 seconds

/** Red tag with the number of NEW (Open) complaints. Put it next to the "Complaints" link/tab. */
export function ComplaintsNavTag() {
  const { data, reload } = useApi<{ complaints: StaffComplaintDTO[] }>("/api/complaints");
  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);
  return <NewTag count={(data?.complaints ?? []).filter((c) => c.status === "Open").length} />;
}

/** Red tag with the number of NEW room-swap requests (status "Pending"). Put it next to the "Swap" link/tab.
 *  ASSUMPTION: GET /api/swaps answers { swaps: [{ status }] } and a new request has status "Pending". */
export function SwapsNavTag() {
  const { data, reload } = useApi<{ swaps?: { status: string }[] }>("/api/swaps");
  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);
  return <NewTag count={(data?.swaps ?? []).filter((s) => s.status === "Pending").length} />;
}
