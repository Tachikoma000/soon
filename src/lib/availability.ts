// Turns raw busy times, day signals and plans into the day-by-day picture
// the app shows. The rules live here so they're easy to tune.

import type { Interval, Plan, Signal, SignalValue } from "./types";
import { addDays, dow, fmtTime, fmtTimeRange, instantOf } from "./dates";

export type DayState = "f" | "m" | "b" | "p"; // free, maybe, blocked, planned together

export type PersonDay = {
  state: DayState;
  /** Busy blocks as local minutes since midnight, merged. */
  blocks: Array<[number, number]>;
  signal: SignalValue | null;
  allDay: boolean;
  planId: string | null;
};

export type DayInfo = Record<string, PersonDay>; // by person id
export type DayMap = Record<string, DayInfo>; // by day

const WAKE: [number, number] = [8 * 60, 23 * 60];

function merge(blocks: Array<[number, number]>): Array<[number, number]> {
  const s = blocks.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Array<[number, number]> = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function busyWithin(blocks: Array<[number, number]>, lo: number, hi: number): number {
  let t = 0;
  for (const [a, b] of blocks) t += Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  return t;
}

/**
 * When does a day count as "blocked" for planning a visit?
 * Ordinary workdays don't: otherwise every weekday would read busy.
 *  - Saturday/Sunday: 6+ busy hours between 9 am and 9 pm.
 *  - Weekdays (incl. Friday): 3+ busy hours in the evening (5:30 – 11 pm).
 *  - Any day: busy 20+ hours (travel, all-day "busy" events).
 */
export function isBlocked(day: string, blocks: Array<[number, number]>): boolean {
  if (busyWithin(blocks, 0, 1440) >= 1200) return true;
  const w = dow(day);
  if (w === 0 || w === 6) return busyWithin(blocks, 540, 1260) >= 360;
  return busyWithin(blocks, 1050, 1380) >= 180;
}

export function buildDays(
  days: string[],
  personIds: string[],
  busy: Record<string, Interval[]>,
  signals: Signal[],
  plans: Plan[],
  tz: string,
): DayMap {
  const bounds = days.map((d) => [instantOf(d, 0, tz), instantOf(addDays(d, 1), 0, tz)] as const);
  const map: DayMap = {};
  for (const d of days) map[d] = {};

  for (const pid of personIds) {
    const perDay: Array<Array<[number, number]>> = days.map(() => []);
    for (const iv of busy[pid] || []) {
      for (let i = 0; i < days.length; i++) {
        const [s, e] = bounds[i];
        if (iv.end <= s || iv.start >= e) continue;
        const a = Math.max(iv.start, s);
        const b = Math.min(iv.end, e);
        perDay[i].push([Math.round((a - s) / 60000), Math.round((b - s) / 60000)]);
      }
    }
    days.forEach((d, i) => {
      const blocks = merge(perDay[i]);
      const signal = signals.find((x) => x.personId === pid && x.day === d)?.value ?? null;
      const allDay = busyWithin(blocks, 0, 1440) >= 1200;
      const plan = plans.find((p) => p.status === "accepted" && d >= p.startDay && d <= p.endDay);
      let state: DayState;
      if (plan) state = "p";
      else if (signal === "free") state = "f";
      else if (signal === "maybe") state = "m";
      else if (signal === "no") state = "b";
      else state = isBlocked(d, blocks) ? "b" : "f";
      map[d][pid] = { state, blocks, signal, allDay, planId: plan?.id ?? null };
    });
  }
  return map;
}

// ── Words ─────────────────────────────────────────────────────────────

type Who = { id: string; name: string; you: boolean };
const busyWord = (w: Who) => (w.you ? "You’re busy" : `${w.name}’s busy`);

/** One line about a single day for both people, as seen by `me`. */
export function daySummary(day: string, info: DayInfo, me: Who, them: Who): string {
  const a = info[me.id];
  const b = info[them.id];
  if (a.state === "p" && b.state === "p") return "Together";
  const people: Array<[Who, PersonDay]> = [[them, b], [me, a]];

  for (const [w, pd] of people) {
    if (pd.signal === "no") return w.you ? "You said you can’t" : `${w.name} can’t make it`;
  }
  for (const [w, pd] of people) {
    if (pd.state === "b") return pd.allDay ? `${busyWord(w)} all day` : `${busyWord(w)} most of the day`;
  }
  for (const [w, pd] of people) {
    if (pd.state === "m") return w.you ? "You said maybe" : `${w.name} said maybe`;
  }

  const wake = (pd: PersonDay) => pd.blocks.filter(([x, y]) => y > WAKE[0] && x < WAKE[1]);
  const wa = wake(a);
  const wb = wake(b);
  if (!wa.length && !wb.length) return "Both free all day";

  // A Friday with daytime work for one or both: when does the evening open up?
  if (dow(day) === 5) {
    const daytime = [...wa, ...wb].filter(([x]) => x < 15 * 60);
    const evening = [...wa, ...wb].filter(([x]) => x >= 15 * 60);
    if (daytime.length && !evening.length) {
      const from = Math.max(...daytime.map(([, y]) => y));
      return `Free together from ${fmtTime(from)}`;
    }
  }

  const phrase = (w: Who, blocks: Array<[number, number]>) => {
    if (!blocks.length) return null;
    if (blocks.length > 1) return `${busyWord(w)} a few times`;
    const [x, y] = blocks[0];
    if (x <= WAKE[0] + 60) return `${busyWord(w)} until ${fmtTime(y)}`;
    if (y >= WAKE[1] - 30) return `${busyWord(w)} from ${fmtTime(x)}`;
    return `${busyWord(w)} ${fmtTimeRange(x, y)}`;
  };
  return [phrase(them, wb), phrase(me, wa)].filter(Boolean).join(" · ");
}

/** One person's day in a few words (used on the incoming-proposal card). */
export function personDayLine(pd: PersonDay): string {
  if (pd.state === "p") return "Together";
  if (pd.signal === "no") return "You said you can’t";
  if (pd.allDay) return "Busy all day";
  const wake = pd.blocks.filter(([x, y]) => y > WAKE[0] && x < WAKE[1]);
  if (!wake.length) return "Nothing planned";
  if (wake.length > 1) return "Busy a few times";
  const [x, y] = wake[0];
  if (x <= WAKE[0] + 60) return `Busy until ${fmtTime(y)}`;
  if (y >= WAKE[1] - 30) return `Busy from ${fmtTime(x)}`;
  return `Busy ${fmtTimeRange(x, y)}`;
}

/** Busy blocks positioned on an 8 am – 11 pm lane, as percentages. */
export function lane(pd: PersonDay): Array<{ left: number; width: number; label: string }> {
  const span = WAKE[1] - WAKE[0];
  return pd.blocks
    .map(([a, b]) => [Math.max(a, WAKE[0]), Math.min(b, WAKE[1])] as const)
    .filter(([a, b]) => b > a)
    .map(([a, b]) => ({
      left: ((a - WAKE[0]) / span) * 100,
      width: ((b - a) / span) * 100,
      label: b - a >= 150 ? "Busy" : "",
    }));
}
