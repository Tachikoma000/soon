// Loaders that gather everything a screen needs, from one person's point of view.

import { buildDays, daySummary, lane, personDayLine, type DayMap, type DayState } from "./availability";
import { busyFor, namedEventsFor, type DayEvent } from "./busy";
import { people, TZ, type PersonConfig } from "./config";
import { DOW_LONG, addDays, daysBetween, dow, fmtRange, listJoin, rangeDays, today, weekendFriday } from "./dates";
import { daysUntil, isActive, traveler } from "./plans";
import { getStore } from "./store";
import type { Plan, Road } from "./types";

type Ctx = { me: PersonConfig; them: PersonConfig };

async function dayMap(from: string, to: string): Promise<{ map: DayMap; plans: Plan[]; connected: Record<string, boolean> }> {
  const store = await getStore();
  const ids = people().map((p) => p.id);
  const [busyA, busyB, signals, plans] = await Promise.all([
    busyFor(ids[0], from, to),
    busyFor(ids[1], from, to),
    store.signals(from, to),
    store.plans(),
  ]);
  const map = buildDays(
    rangeDays(from, to),
    ids,
    { [ids[0]]: busyA.intervals, [ids[1]]: busyB.intervals },
    signals,
    plans,
    TZ,
  );
  return { map, plans, connected: { [ids[0]]: busyA.connected, [ids[1]]: busyB.connected } };
}

// ── Weekends ──────────────────────────────────────────────────────────

export type WeekendRow = {
  fri: string;
  range: string;
  note: string;
  open: boolean;
  planned: boolean;
  pending: boolean;
  days: Array<{ letter: string; me: DayState; them: DayState }>;
};

const NAMES = ["Friday", "Saturday", "Sunday"];
function daysPhrase(idx: number[]): string {
  const k = idx.join("");
  if (k === "012") return "Fri–Sun";
  if (k === "12") return "Sat–Sun";
  if (k === "01") return "Fri–Sat";
  if (k === "02") return "Fri & Sun";
  return NAMES[idx[0]];
}

/** The event that best explains a busy day: an all-day one, else the longest. */
function mainTitle(events: DayEvent[] | undefined): string | null {
  if (!events?.length) return null;
  const allDay = events.find((e) => e.from === null);
  const pick = allDay ?? [...events].sort((a, b) => (b.to! - b.from!) - (a.to! - a.from!))[0];
  return pick.title === "Busy" ? null : pick.title;
}

function weekendRow(fri: string, map: DayMap, plans: Plan[], ctx: Ctx, todayStr: string, named: Record<string, DayEvent[]> | null): WeekendRow {
  const { me, them } = ctx;
  const ds = [fri, addDays(fri, 1), addDays(fri, 2)];
  const st = ds.map((d) => ({ me: map[d][me.id], them: map[d][them.id] }));
  const days = st.map((s, i) => ({ letter: ["F", "S", "S"][i], me: s.me.state, them: s.them.state }));
  const sun = ds[2];
  const off = daysBetween(todayStr, fri);
  const prefix = off <= 4 && todayStr <= sun ? "This weekend · " : "";

  const planId = st.find((s) => s.me.planId)?.me.planId;
  if (planId) {
    const p = plans.find((x) => x.id === planId) as Plan;
    let note: string;
    if (p.kind === "trip") note = p.title || "Our trip";
    else if (p.host === me.id) note = `${them.name}’s here`;
    else note = `You’re in ${them.home}`;
    return { fri, range: fmtRange(fri, sun), note: prefix + note, open: false, planned: true, pending: false, days };
  }

  const proposed = plans.find((p) => p.status === "proposed" && p.endDay >= todayStr && p.startDay <= sun && p.endDay >= fri);
  if (proposed) {
    const note = proposed.proposedBy === me.id ? `Waiting on ${them.name}` : `${them.name} asked about this one`;
    return { fri, range: fmtRange(fri, sun), note: prefix + note, open: false, planned: false, pending: true, days };
  }

  const all =(who: "me" | "them", s: DayState) => [0, 1, 2].filter((i) => st[i][who].state === s);
  const free = (i: number) => st[i].me.state === "f" && st[i].them.state === "f";
  let note: string;
  let open = false;
  if (free(0) && free(1) && free(2)) {
    note = "You’re both free";
    open = true;
  } else if (free(1) && free(2)) {
    note = "Free Saturday and Sunday";
    open = true;
  } else if (all("me", "b").length === 3 && all("them", "b").length === 3) {
    note = "You’re both busy";
  } else {
    const parts: string[] = [];
    const tb = all("them", "b");
    const mb = all("me", "b");
    const tm = all("them", "m");
    const mm = all("me", "m");
    if (tb.length && mb.length) {
      const both = tb.filter((i) => mb.includes(i));
      if (both.length === tb.length && both.length === mb.length) parts.push(`You’re both busy ${daysPhrase(both)}`);
      else parts.push(`${them.name}’s busy ${daysPhrase(tb)}`, `you ${daysPhrase(mb)}`);
    } else if (tb.length) {
      // If they share what's on their calendar, say what it is.
      const titles = [...new Set(tb.map((i) => mainTitle(named?.[ds[i]])))];
      if (titles.length === 1 && titles[0]) parts.push(`${them.name}: ${titles[0]} ${daysPhrase(tb)}`);
      else parts.push(`${them.name}’s busy ${daysPhrase(tb)}`);
    } else if (mb.length) parts.push(`You’re busy ${daysPhrase(mb)}`);
    if (tm.length) parts.push(`${them.name} said maybe ${daysPhrase(tm)}`);
    if (mm.length) parts.push(`You said maybe ${daysPhrase(mm)}`);
    note = parts.slice(0, 2).join(" · ") || "Partly free";
  }
  return { fri, range: fmtRange(fri, sun), note: prefix + note, open, planned: false, pending: false, days };
}

export async function loadWeekends(ctx: Ctx, count = 8) {
  const todayStr = today(TZ);
  const first = weekendFriday(todayStr);
  const last = addDays(first, 7 * (count - 1) + 2);
  const [{ map, plans, connected }, named] = await Promise.all([dayMap(first, last), namedEventsFor(ctx.them.id, rangeDays(first, last))]);
  const rows: WeekendRow[] = [];
  for (let i = 0; i < count; i++) rows.push(weekendRow(addDays(first, 7 * i), map, plans, ctx, todayStr, named));
  const nextFree = rows.find((r) => !r.planned && !r.pending && addDays(r.fri, 2) >= todayStr && r.days[1].me === "f" && r.days[1].them === "f" && r.days[2].me === "f" && r.days[2].them === "f") ?? null;
  return { rows, nextFree, plans, connected };
}

// ── Home ──────────────────────────────────────────────────────────────

export async function loadHome(ctx: Ctx) {
  const { me, them } = ctx;
  const store = await getStore();
  const todayStr = today(TZ);
  const [{ rows, nextFree, plans, connected }, road, mySettings, theirSettings] = await Promise.all([
    loadWeekends(ctx, 6),
    store.road(),
    store.settings(me.id),
    store.settings(them.id),
  ]);

  const upcoming = plans.filter((p) => isActive(p, todayStr)).sort((a, b) => a.startDay.localeCompare(b.startDay));
  const hero = upcoming[0] ?? null;
  const nextTrip = upcoming.find((p) => p.kind === "trip" && p.id !== hero?.id) ?? null;
  const incoming = plans
    .filter((p) => p.status === "proposed" && p.proposedBy === them.id && p.endDay >= todayStr)
    .sort((a, b) => b.createdAt - a.createdAt);
  const waiting = plans.filter((p) => p.status === "proposed" && p.proposedBy === me.id && p.endDay >= todayStr);

  // One line about my own days for the newest incoming proposal: "You’re busy Friday until 5:30 pm."
  let incomingNote: string | null = null;
  if (incoming[0]) {
    const p = incoming[0];
    const end = daysBetween(p.startDay, p.endDay) > 13 ? addDays(p.startDay, 13) : p.endDay;
    const { map } = await dayMap(p.startDay, end);
    const bits = rangeDays(p.startDay, end)
      .map((d) => {
        const line = personDayLine(map[d][me.id]);
        if (line === "Nothing planned" || line === "Together") return null;
        const name = DOW_LONG[dow(d)];
        if (line === "You said you can’t") return `${name} (you said no)`;
        return `${name} ${line.replace(/^Busy /, "")}`;
      })
      .filter((x): x is string => !!x);
    incomingNote = bits.length ? `You’re busy ${listJoin(bits)}.` : "You’re free.";
  }

  let liveRoad: (Road & { plan: Plan }) | null = null;
  if (road && road.eta > Date.now() - 3 * 3600_000) {
    const p = plans.find((x) => x.id === road.planId);
    if (p && p.status === "accepted") liveRoad = { ...road, plan: p };
  }

  const canLeave =
    !!hero && hero.kind === "visit" && traveler(hero) === me.id && hero.startDay === todayStr && liveRoad?.planId !== hero.id;

  return {
    todayStr,
    hero,
    heroDays: hero ? daysUntil(hero, todayStr) : null,
    nextTrip,
    nextTripDays: nextTrip ? daysUntil(nextTrip, todayStr) : null,
    incoming,
    incomingNote,
    waiting,
    rows,
    nextFree,
    road: liveRoad,
    canLeave,
    meConnected: connected[me.id] && mySettings.connected,
    themConnected: connected[them.id] && theirSettings.connected,
    myDefaultTitle: mySettings.eventTitle,
  };
}

// ── One weekend ───────────────────────────────────────────────────────

export async function loadWeekend(ctx: Ctx, fri: string) {
  const { me, them } = ctx;
  const ds = [fri, addDays(fri, 1), addDays(fri, 2)];
  const [{ map, plans }, theirEvents] = await Promise.all([dayMap(fri, ds[2]), namedEventsFor(them.id, ds)]);
  const meW = { id: me.id, name: me.name, you: true };
  const themW = { id: them.id, name: them.name, you: false };
  const days = ds.map((d) => ({
    day: d,
    dow: dow(d),
    summary: daySummary(d, map[d], meW, themW),
    me: { state: map[d][me.id].state, signal: map[d][me.id].signal, lane: lane(map[d][me.id]) },
    them: {
      state: map[d][them.id].state,
      signal: map[d][them.id].signal,
      lane: lane(map[d][them.id]),
      events: theirEvents ? theirEvents[d] ?? [] : null,
    },
  }));
  const plannedId = days.map((d) => map[d.day][me.id].planId).find(Boolean) ?? null;
  const planned = plannedId ? plans.find((p) => p.id === plannedId) ?? null : null;
  const pending = plans.find((p) => p.status === "proposed" && p.startDay <= ds[2] && p.endDay >= fri) ?? null;
  const allFree = days.every((d) => d.me.state === "f" && d.them.state === "f");
  const weekendFree = days.slice(1).every((d) => d.me.state === "f" && d.them.state === "f");
  return { fri, sun: ds[2], range: fmtRange(fri, ds[2]), days, planned, pending, allFree, weekendFree };
}

// ── A month ───────────────────────────────────────────────────────────

export type MonthCell = { day: string; me: DayState; them: DayState; meAllDay: boolean; themAllDay: boolean; planned: boolean };

export async function loadMonth(ctx: Ctx, ym: string) {
  const first = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const last = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
  const { map } = await dayMap(first, last);
  const cells: MonthCell[] = rangeDays(first, last).map((d) => ({
    day: d,
    me: map[d][ctx.me.id].state,
    them: map[d][ctx.them.id].state,
    meAllDay: map[d][ctx.me.id].allDay,
    themAllDay: map[d][ctx.them.id].allDay,
    planned: map[d][ctx.me.id].state === "p",
  }));
  return { first, last, lead: dow(first), cells, todayStr: today(TZ) };
}

// ── Plans ─────────────────────────────────────────────────────────────

export async function loadPlans(ctx: Ctx) {
  const store = await getStore();
  const todayStr = today(TZ);
  const plans = await store.plans();
  const live = (p: Plan) => p.endDay >= todayStr;
  return {
    todayStr,
    incoming: plans.filter((p) => p.status === "proposed" && p.proposedBy === ctx.them.id && live(p)),
    waiting: plans.filter((p) => p.status === "proposed" && p.proposedBy === ctx.me.id && live(p)),
    upcoming: plans.filter((p) => p.status === "accepted" && live(p)).sort((a, b) => a.startDay.localeCompare(b.startDay)),
    past: plans
      .filter((p) => p.status === "accepted" && !live(p))
      .sort((a, b) => b.startDay.localeCompare(a.startDay))
      .slice(0, 3),
  };
}
