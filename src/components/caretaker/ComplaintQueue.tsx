"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/shared/useApi";
import { NewTag } from "@/components/caretaker/NewTag";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";
import { errorMessage, sendJson } from "@/lib/api-client";
import { shortId } from "@/lib/ids";
import type { ComplaintCategory, ComplaintStatus } from "@/types";
import type { StaffComplaintDTO } from "@/types/caretaker";

const RANK: Record<string, number> = { Open: 0, InProgress: 1, Resolved: 2 };
const btn = "rounded-[3px] border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold hover:border-ink disabled:opacity-50";
const btnSm = "rounded-[3px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink disabled:opacity-50";
const days = (n: number) => (n === 0 ? "today" : `${n} day${n === 1 ? "" : "s"} ago`);
const STATUS_TABS = [
  { key: "All", label: "All" },
  { key: "Open", label: "New" },
  { key: "InProgress", label: "In process" },
  { key: "Resolved", label: "Resolved" },
] as const;
const STATUS_LABEL: Record<string, string> = { Open: "New", InProgress: "In process", Resolved: "Resolved" };
const STATUS_STYLE: Record<string, string> = {
  Open: "bg-[#F5EADA] text-[#B8791F]", // amber
  InProgress: "bg-[#E6E9F3] text-[#3B4C86]", // indigo
  Resolved: "bg-[#E2EFE5] text-[#3F7D52]", // green
};
const pill = (on: boolean) =>
  "rounded-full border px-3.5 py-[7px] text-[13px] font-medium " +
  (on ? "border-[#B8791F] bg-[#B8791F] text-white" : "border-line-strong bg-white hover:border-[#B8791F]");
const slug = (c: string) => encodeURIComponent(c.toLowerCase());

/**
 * No `category`  -> all complaints of the hostel (/caretaker/complaints)
 * With `category` -> only that category, its own page (/caretaker/complaints/electrical) and its own Excel.
 */
export function ComplaintQueue({ category }: { category?: ComplaintCategory }) {
  const { data, error, loading, reload } = useApi<{ complaints: StaffComplaintDTO[] }>("/api/complaints");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function setStatus(id: string, status: ComplaintStatus) {
    setBusyId(id);
    setActionError(null);
    try {
      await sendJson(`/api/complaints/${id}/status`, { status }, "PATCH");
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
      reload(); // the list may be out of date (for example, a second caretaker changed it)
    } finally {
      setBusyId(null);
    }
  }

  const everything = data?.complaints ?? [];
  // this page's complaints (one category, or all of them)
  const all = category ? everything.filter((c) => c.category === category) : everything;
  const newIn = (cat?: string) => everything.filter((c) => c.status === "Open" && (!cat || c.category === cat)).length;
  // unresolved first; inside each group the API's newest-first order is kept
  const visible = all
    .filter((c) => statusFilter === "All" || c.status === statusFilter)
    .sort((a, b) => RANK[a.status] - RANK[b.status]);
  const open = all.filter((c) => c.status !== "Resolved").length;
  const countOf = (key: string) => (key === "All" ? all.length : all.filter((c) => c.status === key).length);
  const exportQuery = category ? `&category=${encodeURIComponent(category)}` : "";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px]">{category ? `${category} complaints` : "Complaints"}</h3>
          <span className="font-mono text-xs text-ink-soft">{open} open</span>
        </div>
        <div className="flex gap-2">
          <a href={`/api/complaints/export?format=xlsx${exportQuery}`} className={btn}>
            Download Excel (new only)
          </a>
          <a href={`/api/complaints/export?format=csv${exportQuery}`} className={btn}>
            Download CSV
          </a>
          <a href={`/api/complaints/export?format=pdf${exportQuery}`} className={btn}>
            Download PDF
          </a>
        </div>
      </div>

      {/* Each category is its own page */}
      <nav className="mb-3.5 flex flex-wrap gap-1.5" aria-label="Complaint categories">
        {[
          { label: "All", href: "/caretaker/complaints", active: !category, news: newIn() },
          ...COMPLAINT_CATEGORIES.map((c) => ({ label: c, href: `/caretaker/complaints/${slug(c)}`, active: category === c, news: newIn(c) })),
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={pill(t.active)}
          >
            {t.label}
            <NewTag count={t.news} />
          </Link>
        ))}
      </nav>

      {/* Status filter: new / in process / resolved */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        <span className="mr-1 text-xs font-semibold text-ink-soft">Filter:</span>
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={statusFilter === t.key}
            onClick={() => setStatusFilter(t.key)}
            className={pill(statusFilter === t.key)}
          >
            {t.label} <span className="font-mono">({countOf(t.key)})</span>
          </button>
        ))}
      </div>
      <p className="mb-3.5 text-xs text-ink-soft">Resolved complaints disappear from this list 2 days after they are resolved.</p>

      {error && <p className="mb-3 text-sm text-brick">{error}</p>}
      {actionError && <p className="mb-3 text-sm text-brick">{actionError}</p>}

      {data === null && !error ? (
        <p className="text-sm text-ink-soft">Loading complaints…</p>
      ) : visible.length === 0 && !error ? (
        <p className="rounded-[3px] border border-dashed border-line-strong p-[18px] text-center text-[13px] text-ink-soft">
          {all.length > 0
            ? "No complaints with this status."
            : category
              ? `No ${category.toLowerCase()} complaints yet.`
              : "No complaints from your hostel yet."}
        </p>
      ) : (
        <ul className={"flex flex-col gap-2 " + (loading ? "opacity-70" : "")}>
          {visible.map((c) => (
            <li
              key={c.id}
              className="relative flex gap-3 rounded-r-[3px] border border-l-0 border-[#D7DEDA] bg-white py-2 pr-3 pl-[18px] text-[13px] leading-[1.35]"
            >
              {/* perforated ticket edge, as in the prototype */}
              <span
                aria-hidden
                className="-my-2 -ml-[18px] w-2.5 flex-none border-r border-dashed border-[#B9C3BD]"
                style={{ backgroundImage: "radial-gradient(circle, #EEF2F1 1.6px, transparent 1.7px)", backgroundSize: "10px 10px", backgroundPosition: "center" }}
              />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[11.5px] font-semibold text-black">Ticket ID: {shortId(c.id)}</span>
                  <span className="text-xs text-ink-soft">{days(c.daysOld)}</span>
                </p>
                <p className="mb-1 text-xs font-semibold text-black">Category: {c.category}</p>

                <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                  <p>
                    <span className="text-ink-soft">Name: </span>
                    <span className="font-semibold">{c.studentName}</span>
                  </p>
                  <p className="break-all">
                    <span className="text-ink-soft">Email: </span>
                    {c.email}
                  </p>
                  <p>
                    <span className="text-ink-soft">Mobile No.: </span>
                    {c.mobileNo || "not given"}
                  </p>
                  <p>
                    <span className="text-ink-soft">Room No.: </span>
                    {c.wing}-{c.roomNo}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-ink-soft">Reason: </span>
                    <span className="font-semibold">{c.description}</span>
                  </p>
                </div>

                {c.status !== "Resolved" && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {c.status === "Open" && (
                      <button type="button" disabled={busyId === c.id} onClick={() => setStatus(c.id, "InProgress")} className={btnSm}>
                        Mark in progress
                      </button>
                    )}
                    <button type="button" disabled={busyId === c.id} onClick={() => setStatus(c.id, "Resolved")} className={btnSm}>
                      Mark resolved
                    </button>
                  </div>
                )}

                {c.reregisteredFrom && (
                  <div className="mt-1.5 rounded-[2px] border-l-[3px] border-[#3B4C86] bg-[#EEF2F1] px-2 py-1 text-xs">
                    Re-registered by the student after no response within a week.
                  </div>
                )}
              </div>

              <span className={"h-fit flex-none whitespace-nowrap rounded-[3px] px-[9px] py-0.5 font-mono text-[11.5px] font-semibold " + STATUS_STYLE[c.status]}>
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
