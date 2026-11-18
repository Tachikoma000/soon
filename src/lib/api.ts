// What the iPhone app receives. Wording is decided here, once, so the app and website always agree.

import { otherOf, type PersonConfig } from "./config";
import { fmtDayRange, fmtRange } from "./dates";
import { acceptLabel, countdownPhrase, defaultEventTitle, planName, proposalHeadline, traveler, whereLine } from "./plans";
import type { Plan, Road } from "./types";

export type PlanView = ReturnType<typeof planView>;

export function planView(p: Plan, me: PersonConfig) {
  const them = otherOf(me.id);
  const t = traveler(p);
  return {
    id: p.id,
    kind: p.kind,
    status: p.status,
    startDay: p.startDay,
    endDay: p.endDay,
    arriveTime: p.arriveTime,
    title: p.title,
    note: p.note,
    host: p.host,
    fromMe: p.proposedBy === me.id,
    createdAt: p.createdAt,
    /** "Austin" · "Big Bend" */
    name: planName(p),
    /** "In Austin" · "At home" · "Big Bend" */
    where: whereLine(p, me),
    /** "until Annie" · "until Big Bend" */
    countdown: countdownPhrase(p, me),
    /** What to say on the day it starts. */
    startsToday: p.kind === "trip" ? `${p.title || "Our trip"} starts` : `you’ll see ${them.name}`,
    /** "Nov 20–22" */
    range: fmtRange(p.startDay, p.endDay),
    /** "Fri, Nov 20 – Sun, Nov 22" */
    dayRange: fmtDayRange(p.startDay, p.endDay),
    /** Only for a proposal from them: "Annie wants you to come visit." */
    headline: p.proposedBy === me.id ? null : proposalHeadline(p, me),
    acceptLabel: acceptLabel(p, me),
    /** Who drives: "me", "them", or null for trips. */
    traveler: t === null ? null : t === me.id ? "me" : "them",
    /** How it shows on my own calendar. */
    myEventTitle: p.eventTitles[me.id] ?? null,
    myDefaultEventTitle: defaultEventTitle(p, me.id),
  };
}

export function roadView(r: Road & { plan: Plan }, me: PersonConfig) {
  return { planId: r.planId, mine: r.personId === me.id, leftAt: r.leftAt, eta: r.eta, plan: planView(r.plan, me) };
}

export const personView = (p: PersonConfig) => ({ id: p.id, name: p.name, home: p.home });
