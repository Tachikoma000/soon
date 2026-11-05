import type { Plan } from "./types";
import { DRIVE_MINUTES, otherOf, person, type PersonConfig } from "./config";
import { daysBetween } from "./dates";

/** For a visit, the one who travels. */
export function traveler(plan: Plan): string | null {
  if (plan.kind !== "visit" || !plan.host) return null;
  return otherOf(plan.host).id;
}

/** Short name for a plan: the host's city for a visit, the trip's name for a trip. */
export function planName(plan: Plan): string {
  if (plan.kind === "trip") return plan.title || "A trip";
  return plan.host ? person(plan.host).home : "A visit";
}

/** "until Austin" · "until Annie’s here" · "until Winter trip" */
export function countdownPhrase(plan: Plan, me: PersonConfig): string {
  if (plan.kind === "trip") return `until ${plan.title || "your trip"}`;
  if (plan.host === me.id) return `until ${otherOf(me.id).name}’s here`;
  return `until ${planName(plan)}`;
}

export function proposalHeadline(plan: Plan, me: PersonConfig): string {
  const them = otherOf(me.id).name;
  if (plan.kind === "trip") return `${them} has a trip idea.`;
  if (plan.host === me.id) return `${them} wants to come see you.`;
  return `${them} wants you to come visit.`;
}

export function acceptLabel(plan: Plan, me: PersonConfig): string {
  if (plan.kind === "trip") return "Yes, let’s go";
  if (plan.host === me.id) return "Yes, come see me";
  return "Yes, I’ll come";
}

/** What the plan is called on someone's Google Calendar unless they chose otherwise. */
export function defaultEventTitle(plan: Plan, personId: string): string {
  if (plan.kind === "trip") return plan.title || "Trip";
  if (plan.host === personId) return `${otherOf(personId).name} visiting`;
  return planName(plan);
}

/** Days from today until the plan starts (0 = today, negative = already started). */
export function daysUntil(plan: Plan, todayStr: string): number {
  return daysBetween(todayStr, plan.startDay);
}

/** 0 = tight bud, 1 = full bloom. Opens over the last four weeks. */
export function bloomFor(days: number): number {
  if (days <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - days / 28));
}

export function driveMinutes(): number {
  return DRIVE_MINUTES;
}

export function isActive(plan: Plan, todayStr: string): boolean {
  return plan.status === "accepted" && plan.endDay >= todayStr;
}
