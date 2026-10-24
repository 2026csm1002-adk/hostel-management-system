"use client";

import { useEffect, useState } from "react";
import { HOSTELS, MAX_ROOMS_PER_SLOT } from "@/lib/constants";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDateLabel } from "@/lib/dates";
import { floorLabel } from "@/lib/room";
import type { BoardCell, BoardDTO, BoardGroup } from "@/types/supervisor-board";

type Loaded = { key: string; board: BoardDTO | null; error: string | null };

const buttonClass =
  "rounded-[3px] border border-line-strong bg-white px-3 py-[7px] text-[12.5px] font-semibold hover:border-ink";

// Booking-status colours, as in the prototype (green = space left, brick = full), in a darker shade.
// Change a colour here once and the whole board follows.
const TONE = {
  empty: { box: "bg-white", text: "text-[#2C5A3B]" },
  some: { box: "bg-[#CFE5D6]", text: "text-[#23492F]" },
  full: { box: "bg-[#EBC9BF]", text: "text-[#7E2E1B]" },
} as const;

const cellBorder = "border-b border-r border-line";

function Cell({ cell }: { cell: BoardCell }) {
  const n = cell.rooms.length;
  const full = n >= MAX_ROOMS_PER_SLOT;
  const tone = full ? TONE.full : n > 0 ? TONE.some : TONE.empty;
  return (
    <div className={`${cellBorder} px-2 py-2.5 text-xs ${tone.box}`}>
      <div className={`text-center font-mono font-semibold ${tone.text}`}>
        {n}/{MAX_ROOMS_PER_SLOT}
        {full && " FULL"}
      </div>
      {n > 0 && <div className="mt-0.5 break-words text-center text-[10.5px] text-ink">Rooms: {cell.rooms.join(", ")}</div>}
    </div>
  );
}

function GroupGrid({ group, date }: { group: BoardGroup; date: string | undefined }) {
  const day = group.days.find((d) => d.date === date) ?? group.days[0];
  if (!day) return null;
  return (
    <section>
      <h3 className="mb-2 font-display text-[15px] font-semibold">{group.label}</h3>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[560px] overflow-hidden rounded-[3px] border-l border-t border-line"
          style={{ gridTemplateColumns: `110px repeat(${group.floors.length}, minmax(90px, 1fr))` }}
        >
          <div className={`${cellBorder} bg-ink px-2 py-2.5 text-center font-mono text-xs font-semibold text-white`}>Slot</div>
          {group.floors.map((f) => (
            <div key={f} className={`${cellBorder} bg-ink px-2 py-2.5 text-center font-mono text-xs font-semibold text-white`}>
              {floorLabel(f)}
            </div>
          ))}
          {day.slots.map((slot) => (
            <div key={slot.slotStart} className="contents">
              <div className={`${cellBorder} flex items-center bg-paper px-2 py-2.5 font-mono text-xs font-semibold`}>{slot.label}</div>
              {slot.cells.map((cell) => (
                <Cell key={cell.floor} cell={cell} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
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
  const activeDate = board?.dates.find((d) => d === date) ?? board?.dates[0];
  // downloads cover only the day selected in the tabs below
  const dayParam = activeDate ? `&date=${activeDate}` : "";
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
          <a href={`${exportBase}xlsx&hostelId=${hostelId}${dayParam}`} className={buttonClass}>
            Download Excel
          </a>
          <a href={`${exportBase}pdf&hostelId=${hostelId}${dayParam}`} className={buttonClass}>
            Download PDF
          </a>
          <a href={`${exportBase}xlsx${dayParam}`} className={buttonClass}>
            All hostels (Excel)
          </a>
          <a href={`${exportBase}pdf${dayParam}`} className={buttonClass}>
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
              { n: board.stats.booked, label: `rooms booked, ${board.dates.length} days` },
              { n: `${board.stats.fullSlots} / ${board.stats.totalSlots}`, label: "Slots at full capacity" },
              { n: board.groups.length, label: board.groups.length === 1 ? "slot list shown" : "wings / slot lists shown" },
            ].map((s) => (
              <div key={s.label} className="rounded-[3px] border border-line bg-white px-4 py-3.5">
                <div className="font-display text-[26px] font-bold">{s.n}</div>
                <div className="mt-0.5 text-xs text-ink-soft">{s.label}</div>
              </div>
            ))}
          </div>

          {/* date tabs */}
          <div className="mb-3 flex flex-wrap gap-2">
            {board.dates.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === activeDate}
                onClick={() => setDate(d)}
                className={
                  "rounded-[3px] border px-3 py-1.5 font-mono text-[12.5px] font-semibold " +
                  (d === activeDate ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")
                }
              >
                {formatDateLabel(d)}
                {d === board.today && " · Today"}
              </button>
            ))}
          </div>

          {/* one section per wing (T6: one for all wings): slots down, floors across */}
          <div className="space-y-6">
            {board.groups.map((g) => (
              <GroupGrid key={g.slotGroup} group={g} date={activeDate} />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Each wing has its own slots (T6: all wings share one list), and each floor can take {MAX_ROOMS_PER_SLOT} rooms
            per one-hour slot. The days shown are today and the next {board.dates.length - 1} days, the furthest day a student can book.
          </p>
        </div>
      )}
    </div>
  );
}
