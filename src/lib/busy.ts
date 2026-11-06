import { isDemo, TZ } from "./config";
import { addDays, instantOf } from "./dates";
import { freeBusy, NotConnectedError } from "./google";
import { getStore } from "./store";
import type { Interval } from "./types";

const cache = new Map<string, { at: number; data: Interval[] }>();
const TTL = 60_000;

export type BusyResult = { intervals: Interval[]; connected: boolean };

/** Busy times for a person between two calendar days (inclusive). */
export async function busyFor(personId: string, from: string, to: string): Promise<BusyResult> {
  if (isDemo()) {
    const { demoBusy } = await import("./store/demo");
    return { intervals: demoBusy(personId, from, to), connected: true };
  }
  const key = `${personId}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { intervals: hit.data, connected: true };
  const store = await getStore();
  const s = await store.settings(personId);
  if (!s.connected) return { intervals: [], connected: false };
  try {
    const data = await freeBusy(personId, s.calendars, instantOf(from, 0, TZ), instantOf(addDays(to, 1), 0, TZ));
    cache.set(key, { at: Date.now(), data });
    return { intervals: data, connected: true };
  } catch (e) {
    if (e instanceof NotConnectedError) return { intervals: [], connected: false };
    console.error("freeBusy failed", e);
    return { intervals: [], connected: true };
  }
}

export function forgetBusy(): void {
  cache.clear();
  namedCache.clear();
}

// ── Event names (only for someone who chose to share them) ───────────

/** One event on one day, in local minutes. from/to are null for all-day. */
export type DayEvent = { title: string; from: number | null; to: number | null };

const namedCache = new Map<string, { at: number; data: Record<string, DayEvent[]> }>();

type Timed = { title: string; start: number; end: number; allDay: boolean; startDay?: string; endDay?: string };

export function spreadOverDays(events: Timed[], days: string[]): Record<string, DayEvent[]> {
  const out: Record<string, DayEvent[]> = {};
  for (const d of days) {
    const s = instantOf(d, 0, TZ);
    const e = instantOf(addDays(d, 1), 0, TZ);
    const list: DayEvent[] = [];
    for (const ev of events) {
      if (ev.allDay && ev.startDay && ev.endDay) {
        if (d >= ev.startDay && d < ev.endDay) list.push({ title: ev.title, from: null, to: null });
        continue;
      }
      if (ev.end <= s || ev.start >= e) continue;
      const from = Math.round((Math.max(ev.start, s) - s) / 60000);
      const to = Math.round((Math.min(ev.end, e) - s) / 60000);
      list.push(to - from >= 1200 ? { title: ev.title, from: null, to: null } : { title: ev.title, from, to });
    }
    list.sort((x, y) => (x.from ?? -1) - (y.from ?? -1));
    // The same all-day event can come from two calendars; show it once.
    out[d] = list.filter((x, i) => list.findIndex((y) => y.title === x.title && y.from === x.from && y.to === x.to) === i);
  }
  return out;
}

/** Someone's events by day, if they've chosen to share them. Otherwise null. */
export async function namedEventsFor(personId: string, days: string[]): Promise<Record<string, DayEvent[]> | null> {
  if (!days.length) return null;
  const store = await getStore();
  const s = await store.settings(personId);
  if (!s.shareDetails) return null;
  const from = days[0];
  const to = days[days.length - 1];

  if (isDemo()) {
    const { demoNamedEvents } = await import("./store/demo");
    const evs = demoNamedEvents(personId, from, to).map((e) => ({ ...e, startDay: e.allDay ? e.day : undefined, endDay: e.allDay ? addDays(e.day, 1) : undefined }));
    return spreadOverDays(evs, days);
  }

  const key = `${personId}|${from}|${to}`;
  const hit = namedCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  if (!s.connected) return null;
  try {
    const { listEvents } = await import("./google");
    const raw = await listEvents(personId, s.calendars, instantOf(from, 0, TZ), instantOf(addDays(to, 1), 0, TZ));
    const evs: Timed[] = raw.map((r) =>
      r.allDay
        ? { title: r.title, start: 0, end: 0, allDay: true, startDay: r.start.slice(0, 10), endDay: r.end.slice(0, 10) }
        : { title: r.title, start: Date.parse(r.start), end: Date.parse(r.end), allDay: false },
    );
    const data = spreadOverDays(evs, days);
    namedCache.set(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    // Permission not granted (or revoked): fall back to busy blocks only.
    const { ScopeError, NotConnectedError } = await import("./google");
    if (!(e instanceof ScopeError) && !(e instanceof NotConnectedError)) console.error("listEvents failed", e);
    return null;
  }
}
