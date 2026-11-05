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
}
