// Demo mode: an in-memory store seeded with a believable couple of months,
// laid out relative to today so the app always looks alive.

import type { Interval, Plan, PersonSettings, PushSub, Road, Signal, SignalValue } from "../types";
import type { NewPlan, Store } from "./index";
import { people, TZ } from "../config";
import { addDays, dow, instantOf, today, weekendFriday } from "../dates";

type DemoState = {
  settings: Map<string, PersonSettings>;
  signals: Map<string, Signal>;
  plans: Map<string, Plan>;
  road: Road | null;
};

const g = globalThis as unknown as { __soonDemo?: DemoState };

function anchor(): string {
  return weekendFriday(today(TZ));
}

function seed(): DemoState {
  const [a, b] = people();
  const F0 = anchor();
  const at = (n: number) => addDays(F0, n);
  const settings = new Map<string, PersonSettings>();
  settings.set(a.id, { id: a.id, eventTitle: "Personal", eventPrivate: true, includeDrive: true, calendars: ["primary"], shareDetails: false, connected: true, onboarded: true });
  settings.set(b.id, { id: b.id, eventTitle: null, eventPrivate: false, includeDrive: true, calendars: ["primary"], shareDetails: true, connected: true, onboarded: true });

  const now = Date.now();
  const plans = new Map<string, Plan>();
  const add = (p: Omit<Plan, "createdAt" | "respondedAt" | "eventIds"> & { ago?: number }) => {
    const { ago = 3, ...rest } = p;
    plans.set(p.id, { ...rest, eventIds: {}, createdAt: now - ago * 86400000, respondedAt: p.status === "proposed" ? null : now - (ago - 1) * 86400000 });
  };
  add({ id: "demo-past", kind: "visit", host: a.id, title: null, startDay: at(-7), endDay: at(-5), arriveTime: "18:00", note: null, proposedBy: b.id, status: "accepted", eventTitles: {}, ago: 20 });
  add({ id: "demo-next", kind: "visit", host: b.id, title: null, startDay: at(7), endDay: at(9), arriveTime: "17:30", note: null, proposedBy: a.id, status: "accepted", eventTitles: { [a.id]: "Personal" }, ago: 10 });
  add({ id: "demo-proposed", kind: "visit", host: b.id, title: null, startDay: at(14), endDay: at(16), arriveTime: "17:30", note: "Farmers market on Saturday?", proposedBy: a.id, status: "proposed", eventTitles: { [a.id]: "Personal" }, ago: 0 });
  add({ id: "demo-trip", kind: "trip", host: null, title: "Big Bend", startDay: at(50), endDay: at(55), arriveTime: null, note: "Hiking and stars", proposedBy: b.id, status: "accepted", eventTitles: {}, ago: 14 });

  const signals = new Map<string, Signal>();
  const sig = (personId: string, day: string, value: SignalValue) => signals.set(`${personId}|${day}`, { personId, day, value });
  sig(b.id, at(36), "maybe");
  sig(a.id, at(52), "maybe");

  return { settings, signals, plans, road: null };
}

function state(): DemoState {
  if (!g.__soonDemo) g.__soonDemo = seed();
  return g.__soonDemo;
}

type DemoEvent = { start: number; end: number; title: string; allDay: boolean; day: string };

/** Sample events: ordinary workdays plus a few real plans. */
function demoEvents(personId: string, from: string, to: string): DemoEvent[] {
  const [a, b] = people();
  const F0 = anchor();
  const out: DemoEvent[] = [];
  const add = (day: string, h1: number, h2: number, title: string) =>
    out.push({
      start: instantOf(day, Math.round(h1 * 60), TZ),
      end: instantOf(day, Math.round(h2 * 60), TZ),
      title,
      allDay: h2 - h1 >= 20,
      day,
    });

  const special: Record<string, Record<number, Array<[number, number, string]>>> = {
    [a.id]: {
      16: [[18, 19, "Call"]], 20: [[0, 24, "Busy"]], 28: [[0, 24, "Offsite"]], 29: [[0, 24, "Offsite"]], 30: [[0, 24, "Offsite"]],
      39: [[0, 24, "Busy"]], 48: [[0, 24, "Busy"]], 49: [[0, 24, "Busy"]],
    },
    [b.id]: {
      1: [[10, 16.5, "Museum shift"]], 15: [[10, 11, "Pottery class"]], 20: [[0, 24, "Sam’s wedding"]], 29: [[9, 18, "Workshop"]],
      30: [[9, 18, "Workshop"]], 45: [[0, 24, "Mom visiting"]], 46: [[0, 24, "Mom visiting"]], 48: [[0, 24, "Busy"]], 49: [[0, 24, "Busy"]],
      53: [[0, 24, "Busy"]],
    },
  };

  for (let d = from; d <= to; d = addDays(d, 1)) {
    const n = Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(F0 + "T00:00:00Z")) / 86400000);
    const sp = special[personId]?.[n];
    if (sp) {
      for (const [h1, h2, title] of sp) add(d, h1, h2, title);
      if (sp.some(([h1, h2]) => h2 - h1 >= 20)) continue;
    }
    const w = dow(d);
    if (w >= 1 && w <= 5) {
      if (personId === a.id) add(d, 9, w === 5 ? 15 : 17, "Work");
      else add(d, 9, 17.5, "Work");
    }
  }
  return out;
}

export function demoBusy(personId: string, from: string, to: string): Interval[] {
  return demoEvents(personId, from, to).map(({ start, end }) => ({ start, end }));
}

export function demoNamedEvents(personId: string, from: string, to: string): Array<{ title: string; start: number; end: number; allDay: boolean; day: string }> {
  return demoEvents(personId, from, to);
}

export class DemoStore implements Store {
  async settings(id: string) {
    const s = state().settings.get(id);
    if (!s) throw new Error(`Unknown person ${id}`);
    return { ...s };
  }
  async updateSettings(id: string, patch: Partial<PersonSettings>) {
    const s = state().settings.get(id);
    if (s) state().settings.set(id, { ...s, ...patch, id });
  }
  async email(id: string) {
    return people().find((p) => p.id === id)?.email ?? null;
  }
  async findByEmail(email: string) {
    return people().find((p) => p.email === email.toLowerCase())?.id ?? null;
  }
  async setInvite() {}
  async peekInvite() {
    return null;
  }
  async claimInvite() {
    return null;
  }
  async saveToken() {}
  async getToken() {
    return null;
  }
  async clearToken() {}

  async signals(from: string, to: string) {
    return [...state().signals.values()].filter((s) => s.day >= from && s.day <= to);
  }
  async setSignal(personId: string, day: string, value: SignalValue | null) {
    const k = `${personId}|${day}`;
    if (value) state().signals.set(k, { personId, day, value });
    else state().signals.delete(k);
  }

  async plans() {
    return [...state().plans.values()].map((p) => ({ ...p }));
  }
  async plan(id: string) {
    const p = state().plans.get(id);
    return p ? { ...p } : null;
  }
  async createPlan(p: NewPlan) {
    const plan: Plan = { ...p, id: crypto.randomUUID(), status: "proposed", eventIds: {}, createdAt: Date.now(), respondedAt: null };
    state().plans.set(plan.id, plan);
    return { ...plan };
  }
  async updatePlan(id: string, patch: Partial<Plan>) {
    const p = state().plans.get(id);
    if (p) state().plans.set(id, { ...p, ...patch });
  }

  async road() {
    return state().road;
  }
  async setRoad(r: Road | null) {
    state().road = r;
  }

  async pushSubs(): Promise<PushSub[]> {
    return [];
  }
  async addPushSub() {}
  async removePushSub() {}
}
