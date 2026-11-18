// Everything either of you can do, shared by the website and the iPhone app.
// Each one checks it's allowed, changes the data, writes calendars, and tells the other phone.

import { forgetBusy } from "./busy";
import { removePlanFromCalendars, writePlanToCalendars } from "./calendarWrites";
import { DRIVE_MINUTES, isDemo, TZ } from "./config";
import { daysBetween, fmtFriendlyDay, fmtRange, fmtTime, isDay, today, zoned } from "./dates";
import { proposalHeadline, traveler } from "./plans";
import { liveEnd, liveStart, liveUpdate, notify, pendingCount, refreshWidgets } from "./push";
import type { Viewer } from "./session";
import { getStore } from "./store";
import type { Plan, PersonSettings, Road, SignalValue } from "./types";

export class OpError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

const both = (v: Viewer) => [v.me.id, v.them.id];

/** After any change: forget cached calendars and nudge both phones' widgets. */
async function changed(v: Viewer): Promise<void> {
  forgetBusy();
  await refreshWidgets(both(v));
}

const trim = (s: unknown, max: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.trim().slice(0, max);
  return t.length ? t : null;
};

// ── Days ──────────────────────────────────────────────────────────────

export async function setSignal(v: Viewer, day: unknown, value: unknown): Promise<void> {
  if (!isDay(day) || (value !== null && !["free", "maybe", "no"].includes(value as string))) throw new OpError("bad signal");
  const store = await getStore();
  await store.setSignal(v.me.id, day, value as SignalValue | null);
  await changed(v);
}

// ── Plans ─────────────────────────────────────────────────────────────

export type ProposeInput = {
  /** visit-me: they come to you · visit-them: you go to them · trip: away together */
  kind: "visit-me" | "visit-them" | "trip";
  start: string;
  end: string;
  arrive?: string | null;
  title?: string | null;
  note?: string | null;
  /** How it shows on my calendar, just this once. */
  eventTitle?: string | null;
  /** Remembered for next time when given. */
  private?: boolean;
  drive?: boolean;
};

export async function propose(v: Viewer, input: ProposeInput): Promise<Plan> {
  const { me, them } = v;
  const { start, end } = input;
  if (!["visit-me", "visit-them", "trip"].includes(input.kind)) throw new OpError("kind");
  if (!isDay(start) || !isDay(end) || end < start || start < today(TZ) || daysBetween(start, end) > 30) throw new OpError("dates");
  const store = await getStore();
  const isTrip = input.kind === "trip";
  const arrive = trim(input.arrive, 5);
  const eventTitle = trim(input.eventTitle, 80);

  const remember: Partial<PersonSettings> = {};
  if (typeof input.private === "boolean") remember.eventPrivate = input.private;
  if (typeof input.drive === "boolean") remember.includeDrive = input.drive;
  if (Object.keys(remember).length) await store.updateSettings(me.id, remember);

  const plan = await store.createPlan({
    kind: isTrip ? "trip" : "visit",
    host: isTrip ? null : input.kind === "visit-me" ? me.id : them.id,
    title: isTrip ? trim(input.title, 60) : null,
    startDay: start,
    endDay: end,
    arriveTime: isTrip ? null : arrive && /^\d{2}:\d{2}$/.test(arrive) ? arrive : "17:30",
    note: trim(input.note, 280),
    proposedBy: me.id,
    eventTitles: eventTitle ? { [me.id]: eventTitle } : {},
  });

  await notify(them.id, {
    title: proposalHeadline(plan, them).replace(/\.$/, ""),
    body: fmtRange(plan.startDay, plan.endDay) + (plan.note ? ` · “${plan.note}”` : ""),
    url: "/",
    tag: plan.id,
    badge: await pendingCount(them.id),
    category: "proposal",
    planId: plan.id,
  });
  await changed(v);
  return plan;
}

async function proposalFromThem(v: Viewer, planId: string): Promise<Plan> {
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan) throw new OpError("not found", 404);
  if (plan.status !== "proposed" || plan.proposedBy !== v.them.id) throw new OpError("already answered", 409);
  return plan;
}

export async function accept(v: Viewer, planId: string, eventTitle?: string | null): Promise<Plan> {
  const { me, them } = v;
  const store = await getStore();
  const plan = await proposalFromThem(v, planId);
  const titles = { ...plan.eventTitles };
  const t = trim(eventTitle, 80);
  if (t) titles[me.id] = t;
  const accepted: Plan = { ...plan, eventTitles: titles, status: "accepted", respondedAt: Date.now() };
  const eventIds = await writePlanToCalendars(accepted);
  await store.updatePlan(plan.id, { status: "accepted", eventTitles: titles, eventIds, respondedAt: accepted.respondedAt });
  await notify(them.id, {
    title: `${me.name} said yes`,
    body: `See you ${fmtFriendlyDay(plan.startDay)}.`,
    url: "/",
    tag: plan.id,
  });
  await changed(v);
  return { ...accepted, eventIds };
}

export async function decline(v: Viewer, planId: string): Promise<Plan> {
  const { me, them } = v;
  const store = await getStore();
  const plan = await proposalFromThem(v, planId);
  await store.updatePlan(plan.id, { status: "declined", respondedAt: Date.now() });
  await notify(them.id, {
    title: `${me.name} can’t do ${fmtRange(plan.startDay, plan.endDay)}`,
    body: "Find another weekend?",
    url: "/calendar",
    tag: plan.id,
  });
  await changed(v);
  return { ...plan, status: "declined" };
}

export async function cancel(v: Viewer, planId: string): Promise<void> {
  const { me, them } = v;
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan) throw new OpError("not found", 404);
  if (plan.status === "cancelled" || plan.status === "declined") throw new OpError("already off", 409);
  if (plan.status === "proposed" && plan.proposedBy !== me.id) throw new OpError("not yours", 403);
  if (plan.status === "accepted") await removePlanFromCalendars(plan);
  await store.updatePlan(plan.id, { status: "cancelled", eventIds: {} });
  const road = await store.road();
  if (road?.planId === plan.id) {
    await store.setRoad(null);
    await liveEnd(both(v), road, false);
  }
  await notify(them.id, {
    title: plan.status === "accepted" ? `${me.name} cancelled ${fmtRange(plan.startDay, plan.endDay)}` : `${me.name} took back ${fmtRange(plan.startDay, plan.endDay)}`,
    body: plan.status === "accepted" ? "It’s off both your calendars." : "",
    url: "/plans",
    tag: plan.id,
  });
  await changed(v);
}

// ── On the way ────────────────────────────────────────────────────────

const clock = (ms: number) => fmtTime(zoned(ms, TZ).minutes);

/**
 * I'm leaving now. The other phone gets a Live Activity (or a plain notification if it can't).
 * startedHere: the app already started one on this phone.
 */
export async function leave(v: Viewer, planId: string, opts: { startedHere?: boolean } = {}): Promise<Road> {
  const { me, them } = v;
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan || plan.status !== "accepted" || traveler(plan) !== me.id) throw new OpError("not your drive", 409);
  const now = Date.now();
  const road: Road = { planId: plan.id, personId: me.id, leftAt: now, eta: now + DRIVE_MINUTES * 60_000 };
  await store.setRoad(road);

  const host = plan.host as string;
  const startFor = opts.startedHere ? [them.id] : [them.id, me.id];
  const started = await liveStart(startFor, road, host, (id) =>
    id === me.id ? { title: `On the way to ${them.name}`, body: `There around ${clock(road.eta)}.` } : { title: `${me.name}’s on the way`, body: `There around ${clock(road.eta)}.` },
  );
  // Their phone already buzzed with the Live Activity; don't buzz it twice.
  await notify(them.id, { title: `${me.name}’s on the way`, body: `There around ${clock(road.eta)}.`, url: "/", tag: "road" }, { iphone: !started.has(them.id) });
  await changed(v);
  return road;
}

/** Hit traffic: push the arrival time back. */
export async function runningLate(v: Viewer, minutes: number): Promise<Road> {
  const { me, them } = v;
  const store = await getStore();
  const road = await store.road();
  if (!road || road.personId !== me.id) throw new OpError("not driving", 409);
  const add = Math.max(5, Math.min(120, Math.round(Number(minutes) || 15)));
  const next: Road = { ...road, eta: Math.max(road.eta, Date.now()) + add * 60_000 };
  await store.setRoad(next);
  const body = `There around ${clock(next.eta)}.`;
  const updated = await liveUpdate(both(v), next, (id) => (id === them.id ? { title: `${me.name}’s running a little late`, body } : null));
  await notify(them.id, { title: `${me.name}’s running a little late`, body, url: "/", tag: "road" }, { iphone: !updated.has(them.id) });
  await changed(v);
  return next;
}

/** Made it (either of you can say so). */
export async function arrived(v: Viewer): Promise<void> {
  const store = await getStore();
  const road = await store.road();
  await store.setRoad(null);
  if (road) await liveEnd(both(v), road, true);
  await changed(v);
}

// ── Settings ──────────────────────────────────────────────────────────

export type SettingsInput = {
  eventTitle?: string | null;
  eventPrivate?: boolean;
  includeDrive?: boolean;
  calendars?: string[];
};

export async function saveSettings(v: Viewer, input: SettingsInput): Promise<void> {
  const store = await getStore();
  const patch: Partial<PersonSettings> = {};
  if ("eventTitle" in input) patch.eventTitle = trim(input.eventTitle, 80);
  if (typeof input.eventPrivate === "boolean") patch.eventPrivate = input.eventPrivate;
  if (typeof input.includeDrive === "boolean") patch.includeDrive = input.includeDrive;
  if (Array.isArray(input.calendars)) {
    const cals = input.calendars.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 300).slice(0, 50);
    patch.calendars = cals.length ? cals : ["primary"];
  }
  await store.updateSettings(v.me.id, patch);
  await changed(v);
}

/** "Let them see what's on my calendar." Turning it on needs one more Google permission. */
export async function setShareDetails(v: Viewer, on: boolean): Promise<"ok" | "consent"> {
  const store = await getStore();
  if (on && !isDemo()) {
    const { canReadEvents } = await import("./google");
    if (!(await canReadEvents(v.me.id))) return "consent";
  }
  await store.updateSettings(v.me.id, { shareDetails: on });
  await changed(v);
  return "ok";
}

export async function finishOnboarding(v: Viewer): Promise<void> {
  const store = await getStore();
  await store.updateSettings(v.me.id, { onboarded: true });
}

/** A one-time link for the other person to join with whichever Google account they like. */
export async function createInvite(v: Viewer): Promise<string | null> {
  if (isDemo()) return null;
  const { makeInvite } = await import("./invite");
  return makeInvite(v.them.id);
}

