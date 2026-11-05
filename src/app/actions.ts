"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { forgetBusy } from "@/lib/busy";
import { removePlanFromCalendars, writePlanToCalendars } from "@/lib/calendarWrites";
import { DRIVE_MINUTES, isDemo, people, TZ } from "@/lib/config";
import { daysBetween, fmtFriendlyDay, fmtRange, fmtTime, isDay, today, zoned } from "@/lib/dates";
import { notify, pendingCount } from "@/lib/push";
import { proposalHeadline, traveler } from "@/lib/plans";
import { requireViewer, setDemoViewer } from "@/lib/session";
import { getStore } from "@/lib/store";
import type { SignalValue } from "@/lib/types";

function refresh() {
  forgetBusy();
  revalidatePath("/", "layout");
}

const clean = (v: FormDataEntryValue | null, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
};

export async function setSignal(day: string, value: SignalValue | null): Promise<void> {
  const { me } = await requireViewer();
  if (!isDay(day) || (value !== null && !["free", "maybe", "no"].includes(value))) return;
  const store = await getStore();
  await store.setSignal(me.id, day, value);
  refresh();
}

export async function proposePlan(form: FormData): Promise<void> {
  const { me, them } = await requireViewer();
  const store = await getStore();
  const kind = form.get("kind");
  const start = form.get("start");
  const end = form.get("end");
  const todayStr = today(TZ);
  if (!isDay(start) || !isDay(end) || end < start || start < todayStr || daysBetween(start, end) > 30) {
    redirect(`/propose?error=dates`);
  }
  const isTrip = kind === "trip";
  const host = isTrip ? null : kind === "visit-me" ? me.id : them.id;
  const arrive = clean(form.get("arrive"), 5);
  const eventTitle = clean(form.get("eventTitle"), 80);

  await store.updateSettings(me.id, {
    eventPrivate: form.get("private") === "on",
    ...(form.has("drive") || form.get("driveShown") === "1" ? { includeDrive: form.get("drive") === "on" } : {}),
  });

  const plan = await store.createPlan({
    kind: isTrip ? "trip" : "visit",
    host,
    title: isTrip ? clean(form.get("title"), 60) : null,
    startDay: start,
    endDay: end,
    arriveTime: isTrip ? null : arrive && /^\d{2}:\d{2}$/.test(arrive) ? arrive : "17:30",
    note: clean(form.get("note"), 280),
    proposedBy: me.id,
    eventTitles: eventTitle ? { [me.id]: eventTitle } : {},
  });

  await notify(them.id, {
    title: proposalHeadline(plan, them).replace(/\.$/, ""),
    body: fmtRange(plan.startDay, plan.endDay) + (plan.note ? ` · “${plan.note}”` : ""),
    url: "/",
    tag: plan.id,
    badge: await pendingCount(them.id),
  });
  refresh();
  redirect("/plans");
}

export async function acceptPlan(planId: string, eventTitle?: string | null): Promise<void> {
  const { me, them } = await requireViewer();
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan || plan.status !== "proposed" || plan.proposedBy !== them.id) return;
  const titles = { ...plan.eventTitles };
  const t = eventTitle?.trim().slice(0, 80);
  if (t) titles[me.id] = t;
  const accepted = { ...plan, eventTitles: titles, status: "accepted" as const, respondedAt: Date.now() };
  const eventIds = await writePlanToCalendars(accepted);
  await store.updatePlan(plan.id, { status: "accepted", eventTitles: titles, eventIds, respondedAt: Date.now() });
  await notify(them.id, {
    title: `${me.name} said yes`,
    body: `See you ${fmtFriendlyDay(plan.startDay)}.`,
    url: "/",
    tag: plan.id,
  });
  refresh();
  redirect(`/?yes=${plan.id}`);
}

export async function declinePlan(planId: string): Promise<void> {
  const { me, them } = await requireViewer();
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan || plan.status !== "proposed" || plan.proposedBy !== them.id) return;
  await store.updatePlan(plan.id, { status: "declined", respondedAt: Date.now() });
  await notify(them.id, {
    title: `${me.name} can’t do ${fmtRange(plan.startDay, plan.endDay)}`,
    body: "Find another weekend?",
    url: "/calendar",
    tag: plan.id,
  });
  refresh();
  redirect(`/calendar?m=${plan.startDay.slice(0, 7)}`);
}

export async function cancelPlan(planId: string): Promise<void> {
  const { me, them } = await requireViewer();
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan || plan.status === "cancelled" || plan.status === "declined") return;
  if (plan.status === "proposed" && plan.proposedBy !== me.id) return;
  if (plan.status === "accepted") await removePlanFromCalendars(plan);
  await store.updatePlan(plan.id, { status: "cancelled", eventIds: {} });
  const road = await store.road();
  if (road?.planId === plan.id) await store.setRoad(null);
  await notify(them.id, {
    title: plan.status === "accepted" ? `${me.name} cancelled ${fmtRange(plan.startDay, plan.endDay)}` : `${me.name} took back ${fmtRange(plan.startDay, plan.endDay)}`,
    body: plan.status === "accepted" ? "It’s off both your calendars." : "",
    url: "/plans",
    tag: plan.id,
  });
  refresh();
}

export async function leaveNow(planId: string): Promise<void> {
  const { me, them } = await requireViewer();
  const store = await getStore();
  const plan = await store.plan(planId);
  if (!plan || plan.status !== "accepted" || traveler(plan) !== me.id) return;
  const now = Date.now();
  const eta = now + DRIVE_MINUTES * 60_000;
  await store.setRoad({ planId: plan.id, personId: me.id, leftAt: now, eta });
  await notify(them.id, {
    title: `${me.name}’s on the way`,
    body: `There around ${fmtTime(zoned(eta, TZ).minutes)}.`,
    url: "/",
    tag: "road",
  });
  refresh();
}

export async function clearRoad(): Promise<void> {
  await requireViewer();
  const store = await getStore();
  await store.setRoad(null);
  refresh();
}

export async function saveSettings(form: FormData): Promise<void> {
  const { me } = await requireViewer();
  const store = await getStore();
  const cals = form.getAll("calendars").filter((x): x is string => typeof x === "string" && x.length < 300);
  await store.updateSettings(me.id, {
    eventTitle: clean(form.get("eventTitle"), 80),
    eventPrivate: form.get("private") === "on",
    includeDrive: form.get("drive") === "on",
    ...(form.get("calendarsShown") === "1" ? { calendars: cals.length ? cals : ["primary"] } : {}),
  });
  refresh();
  redirect("/settings?saved=1");
}

export async function finishOnboarding(): Promise<void> {
  const { me } = await requireViewer();
  const store = await getStore();
  await store.updateSettings(me.id, { onboarded: true });
  redirect("/");
}

/** A one-time link for the other person to join with whichever Google account they like. */
export async function createInvite(): Promise<string | null> {
  const { them } = await requireViewer();
  if (isDemo()) return null;
  const { makeInvite } = await import("@/lib/invite");
  return makeInvite(them.id);
}

export async function enterDemo(id: string): Promise<void> {
  if (!isDemo() || !people().some((p) => p.id === id)) return;
  await setDemoViewer(id);
  redirect("/");
}
