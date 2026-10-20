"use client";

import { useEffect, useState } from "react";
import { HOSTELS, MAX_ROOMS_PER_SLOT } from "@/lib/constants";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDateLabel } from "@/lib/dates";
import { floorLabel } from "@/lib/room";
import type { BoardCell, BoardDTO } from "@/types";

type Loaded = { key: string; board: BoardDTO | null; error: string | null };

const buttonClass =
  "rounded-[3px] border border-line-strong bg-white px-3 py-[7px] text-[12.5px] font-semibold hover:border-ink";

function Cell({ cell }: { cell: BoardCell }) {
  const n = cell.rooms.length;
  const full = n >= MAX_ROOMS_PER_SLOT;
  const tone = full ? "bg-brick-soft" : n > 0 ? "bg-teal-soft" : "bg-paper";
  return (
    <div className={`min-h-[64px] rounded-[3px] px-2.5 py-2 ${tone}`}>
      <div className={"font-mono text-[11.5px] font-semibold " + (full ? "text-brick" : n > 0 ? "text-teal" : "text-ink-soft")}>
        {n}/{MAX_ROOMS_PER_SLOT}
        {full && " FULL"}
      </div>
      {n > 0 && <div className="mt-1 break-words font-mono text-xs">{cell.rooms.join(", ")}</div>}
    </div>
  );
}

export function CapacityBoard() {
  const [hostelId, setHostelId] = useState<string>(HOSTELS[0].id);
  const [date, setDate] = useState<string | null>(null); // null = the first day (today)
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${hostelId}#${refresh}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ board: BoardDTO }>(`/api/cleaning/schedule?hostelId=${hostelId}`)
      .then((d) => !cancelled && setLoaded({ key, board: d.board, error: null }))
      .catch((e) => !cancelled && setLoaded({ key, board: null, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [hostelId, key]);

  const board = loaded?.board ?? null;
  const showing = loaded?.key === key; // false while the new answer is still on its way
  const day = board?.days.find((d) => d.date === date) ?? board?.days[0];
  const exportBase = "/api/cleaning/export?format=";

  return (
    <div>
      {/* controls */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="hostel" className="mb-1.5 block text-[12.5px] font-semibold">
            Hostel
          </label>
          <select
            id="hostel"
            value={hostelId}
            onChange={(e) => setHostelId(e.target.value)}
            className="rounded-[3px] border border-line-strong bg-white px-[11px] py-[9px]"
          >
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRefresh((n) => n + 1)} className={buttonClass}>
            Refresh
          </button>
          <a href={`${exportBase}csv&hostelId=${hostelId}`} className={buttonClass}>
            Download CSV
          </a>
          <a href={`${exportBase}pdf&hostelId=${hostelId}`} className={buttonClass}>
            Download PDF
          </a>
          <a href={`${exportBase}csv`} className={buttonClass}>
            All hostels (CSV)
          </a>
          <a href={`${exportBase}pdf`} className={buttonClass}>
            All hostels (PDF)
          </a>
        </div>
      </div>

      {loaded?.error && showing && <p className="mb-3 text-sm text-brick">{loaded.error}</p>}

      {!board ? (
        <p className="text-sm text-ink-soft">{loaded?.error ? "" : "Loading the schedule…"}</p>
      ) : (
        <div className={showing ? "" : "opacity-60"}>
          {/* stats */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              { n: board.stats.booked, label: `rooms booked, ${board.days.length} days` },
              { n: board.stats.fullSlots, label: "floor-slots at full capacity" },
              { n: board.floors.length, label: "floors shown" },
            ].map((s) => (
              <div key={s.label} className="rounded-[3px] border border-line bg-white px-4 py-3">
                <div className="font-display text-2xl font-semibold">{s.n}</div>
                <div className="text-xs text-ink-soft">{s.label}</div>
              </div>
            ))}
          </div>

          {/* date tabs */}
          <div className="mb-3 flex flex-wrap gap-2">
            {board.days.map((d) => (
              <button
                key={d.date}
                type="button"
                aria-pressed={d.date === day?.date}
                onClick={() => setDate(d.date)}
                className={
                  "rounded-[3px] border px-3 py-1.5 text-[13px] font-semibold " +
                  (d.date === day?.date ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")
                }
              >
                {formatDateLabel(d.date)}
                {d.date === board.today && " · Today"}
              </button>
            ))}
          </div>

          {/* grid: slots down, floors across */}
          {day && (
            <div className="overflow-x-auto rounded-[3px] border border-line bg-white p-3">
              <div
                className="grid min-w-[560px] gap-2"
                style={{ gridTemplateColumns: `120px repeat(${board.floors.length}, minmax(110px, 1fr))` }}
              >
                <div />
                {board.floors.map((f) => (
                  <div key={f} className="px-1 pb-1 text-[12.5px] font-semibold">
                    {floorLabel(f)}
                  </div>
                ))}
                {day.slots.map((slot) => (
                  <div key={slot.slotStart} className="contents">
                    <div className="flex items-center px-1 font-mono text-[12.5px] font-semibold">{slot.label}</div>
                    {slot.cells.map((cell) => (
                      <Cell key={cell.floor} cell={cell} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            Each floor can take {MAX_ROOMS_PER_SLOT} rooms per one-hour slot. The days shown are today and the next
            four, the furthest day a student can book.
          </p>
        </div>
      )}
    </div>
  );
}
