// Writes accepted plans onto both people's Google Calendars, and removes them again.

import { DRIVE_MINUTES, isDemo, people, TZ } from "./config";
import { addDays, hhmmToMinutes, isoLocal } from "./dates";
import { deleteEvent, insertEvent, type EventInput } from "./google";
import { defaultEventTitle, traveler } from "./plans";
import { getStore } from "./store";
import type { Plan } from "./types";

const VISIT_END = 16 * 60; // Head home Sunday afternoon.

export async function eventFor(plan: Plan, personId: string): Promise<EventInput> {
  const store = await getStore();
  const s = await store.settings(personId);
  const summary = (plan.eventTitles[personId] || s.eventTitle || defaultEventTitle(plan, personId)).slice(0, 120);
  if (plan.kind === "trip") {
    return {
      summary,
      private: s.eventPrivate,
      start: { date: plan.startDay },
      end: { date: addDays(plan.endDay, 1) },
    };
  }
  const drive = traveler(plan) === personId && s.includeDrive ? DRIVE_MINUTES : 0;
  const arrive = hhmmToMinutes(plan.arriveTime, 17 * 60 + 30);
  const startMin = Math.max(0, arrive - drive);
  const endMin = Math.min(23 * 60 + 59, VISIT_END + drive);
  return {
    summary,
    private: s.eventPrivate,
    start: { dateTime: isoLocal(plan.startDay, startMin, TZ), timeZone: TZ },
    end: { dateTime: isoLocal(plan.endDay, endMin, TZ), timeZone: TZ },
  };
}

/** Returns the event ids it managed to write; failures are logged, not fatal. */
export async function writePlanToCalendars(plan: Plan): Promise<Record<string, string>> {
  if (isDemo()) return {};
  const ids: Record<string, string> = { ...plan.eventIds };
  for (const p of people()) {
    if (ids[p.id]) continue;
    try {
      ids[p.id] = await insertEvent(p.id, await eventFor(plan, p.id));
    } catch (e) {
      console.error(`Could not add plan to ${p.id}'s calendar`, e);
    }
  }
  return ids;
}

export async function removePlanFromCalendars(plan: Plan): Promise<void> {
  if (isDemo()) return;
  for (const [pid, eventId] of Object.entries(plan.eventIds)) {
    try {
      await deleteEvent(pid, eventId);
    } catch (e) {
      console.error(`Could not remove plan from ${pid}'s calendar`, e);
    }
  }
}
