// The iPhone app's API. Every request carries "Authorization: Bearer <token>" from signing in.

import { NextResponse } from "next/server";
import { personView, planView, roadView } from "@/lib/api";
import { appUrl, DRIVE_MINUTES, isDemo, otherOf, people, person, TZ } from "@/lib/config";
import { loadHome, loadMonth, loadPlans, loadWeekend, loadWeekends } from "@/lib/data";
import { dow, isDay, today } from "@/lib/dates";
import * as ops from "@/lib/ops";
import { pendingCount } from "@/lib/push";
import { appToken, currentPersonId, ticketFor, type Viewer } from "@/lib/session";
import { getStore } from "@/lib/store";
import type { DeviceKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ path: string[] }> };
type Body = Record<string, unknown>;

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

const str = (x: unknown) => (typeof x === "string" ? x : null);
const bool = (x: unknown) => (typeof x === "boolean" ? x : undefined);

function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A promise that gives up quietly, for things a widget can live without. */
async function within<T>(ms: number, p: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((r) => (timer = setTimeout(() => r(fallback), ms)));
  try {
    return await Promise.race([p.catch(() => fallback), late]);
  } finally {
    clearTimeout(timer);
  }
}

async function meView(v: Viewer) {
  const store = await getStore();
  const [s, theirs] = await Promise.all([store.settings(v.me.id), store.settings(v.them.id)]);
  return {
    me: personView(v.me),
    them: personView(v.them),
    timezone: TZ,
    driveMinutes: DRIVE_MINUTES,
    site: appUrl(),
    demo: isDemo(),
    settings: {
      eventTitle: s.eventTitle,
      eventPrivate: s.eventPrivate,
      includeDrive: s.includeDrive,
      calendars: s.calendars,
      shareDetails: s.shareDetails,
      connected: s.connected,
      onboarded: s.onboarded,
    },
    theyJoined: theirs.connected,
    theyShare: theirs.shareDetails,
    maker: people()[0].id === v.me.id,
    /** A fresh token each time, so the app never runs out. */
    token: isDemo() ? `demo:${v.me.id}` : await appToken(v.me.id),
  };
}

async function homeView(v: Viewer) {
  const d = await loadHome(v);
  const pv = (p: Parameters<typeof planView>[0]) => planView(p, v.me);
  return {
    today: d.todayStr,
    hero: d.hero ? pv(d.hero) : null,
    heroDays: d.heroDays,
    nextTrip: d.nextTrip ? pv(d.nextTrip) : null,
    nextTripDays: d.nextTripDays,
    incoming: d.incoming.map(pv),
    incomingNote: d.incomingNote,
    waiting: d.waiting.map(pv),
    weekends: d.rows,
    nextFree: d.nextFree,
    road: d.road ? roadView(d.road, v.me) : null,
    canLeave: d.canLeave,
    meConnected: d.meConnected,
    themConnected: d.themConnected,
    badge: d.incoming.length,
  };
}

/** Just enough for the widgets: no calendar reads unless they're quick. */
async function widgetView(v: Viewer) {
  const store = await getStore();
  const todayStr = today(TZ);
  const [plans, road, badge, free] = await Promise.all([
    store.plans(),
    store.road(),
    pendingCount(v.me.id),
    within(2500, loadWeekends(v, 8).then((w) => w.nextFree), null),
  ]);
  const upcoming = plans
    .filter((p) => p.status === "accepted" && p.endDay >= todayStr)
    .sort((a, b) => a.startDay.localeCompare(b.startDay))
    .slice(0, 6)
    .map((p) => planView(p, v.me));
  const roadPlan = road ? plans.find((p) => p.id === road.planId && p.status === "accepted") : null;
  const liveRoad = road && roadPlan && road.eta > Date.now() - 3 * 3600_000 ? roadView({ ...road, plan: roadPlan }, v.me) : null;
  return {
    me: personView(v.me),
    them: personView(v.them),
    today: todayStr,
    generatedAt: Date.now(),
    upcoming,
    badge,
    road: liveRoad,
    nextFree: free ? { fri: free.fri, range: free.range } : null,
  };
}

async function route(v: Viewer, method: string, path: string[], req: Request): Promise<Response> {
  const [a, b, c] = path;
  const body: Body = method === "GET" || method === "DELETE" ? {} : ((await req.json().catch(() => ({}))) as Body) ?? {};
  const store = await getStore();

  // ── Reading ──
  if (method === "GET") {
    if (a === "me" && !b) return json(await meView(v));
    if (a === "home" && !b) return json(await homeView(v));
    if (a === "widget" && !b) return json(await widgetView(v));
    if (a === "weekends" && !b) {
      const count = Math.max(1, Math.min(26, Number(new URL(req.url).searchParams.get("count")) || 12));
      const w = await loadWeekends(v, count);
      return json({ weekends: w.rows, nextFree: w.nextFree });
    }
    if (a === "weekend" && b && !c) {
      if (!isDay(b) || dow(b) !== 5) return json({ error: "not a friday" }, 400);
      const w = await loadWeekend(v, b);
      return json({
        ...w,
        planned: w.planned ? planView(w.planned, v.me) : null,
        pending: w.pending ? planView(w.pending, v.me) : null,
      });
    }
    if (a === "month" && b && !c) {
      const thisMonth = today(TZ).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(b) || b < thisMonth || b > shiftMonth(thisMonth, 12)) return json({ error: "month" }, 400);
      return json(await loadMonth(v, b));
    }
    if (a === "plans" && !b) {
      const p = await loadPlans(v);
      const pv = (x: Parameters<typeof planView>[0]) => planView(x, v.me);
      return json({ today: p.todayStr, incoming: p.incoming.map(pv), waiting: p.waiting.map(pv), upcoming: p.upcoming.map(pv), past: p.past.map(pv) });
    }
    if (a === "calendars" && !b) {
      if (isDemo()) return json({ calendars: [{ id: "primary", name: "Main calendar", primary: true, owned: true }] });
      const { listCalendars } = await import("@/lib/google");
      return json({ calendars: await listCalendars(v.me.id) });
    }
  }

  // ── Plans ──
  if (a === "plans" && method === "POST" && !b) {
    const plan = await ops.propose(v, {
      kind: str(body.kind) as ops.ProposeInput["kind"],
      start: str(body.start) ?? "",
      end: str(body.end) ?? "",
      arrive: str(body.arrive),
      title: str(body.title),
      note: str(body.note),
      eventTitle: str(body.eventTitle),
      private: bool(body.private),
      drive: bool(body.drive),
    });
    return json({ plan: planView(plan, v.me) }, 201);
  }
  if (a === "plans" && b && method === "POST") {
    if (c === "accept") return json({ plan: planView(await ops.accept(v, b, str(body.eventTitle)), v.me) });
    if (c === "decline") return json({ plan: planView(await ops.decline(v, b), v.me) });
    if (c === "cancel") {
      await ops.cancel(v, b);
      return json({ ok: true });
    }
  }

  // ── Days ──
  if (a === "signal" && method === "POST" && !b) {
    await ops.setSignal(v, body.day, body.value ?? null);
    return json({ ok: true });
  }

  // ── On the way ──
  if (a === "road" && !b && method === "POST") {
    const road = await ops.leave(v, str(body.planId) ?? "", { startedHere: body.startedHere === true });
    return json({ road });
  }
  if (a === "road" && b === "late" && method === "POST") return json({ road: await ops.runningLate(v, Number(body.minutes) || 15) });
  if (a === "road" && !b && method === "DELETE") {
    await ops.arrived(v);
    return json({ ok: true });
  }

  // ── Settings ──
  if (a === "settings" && !b && method === "PATCH") {
    await ops.saveSettings(v, {
      ...("eventTitle" in body ? { eventTitle: str(body.eventTitle) } : {}),
      eventPrivate: bool(body.eventPrivate),
      includeDrive: bool(body.includeDrive),
      ...(Array.isArray(body.calendars) ? { calendars: body.calendars as string[] } : {}),
    });
    return json(await meView(v));
  }
  if (a === "share" && !b && method === "POST") {
    const on = body.on === true;
    const r = await ops.setShareDetails(v, on);
    if (r === "ok") return json({ status: "ok" });
    const url = `${appUrl()}/api/auth/google?share=1&app=1&ticket=${encodeURIComponent(await ticketFor(v.me.id))}`;
    return json({ status: "consent", url });
  }
  if (a === "onboarded" && !b && method === "POST") {
    await ops.finishOnboarding(v);
    return json({ ok: true });
  }
  if (a === "invite" && !b && method === "POST") return json({ url: await ops.createInvite(v) });

  // ── Push tokens ──
  if (a === "devices" && !b && method === "POST") {
    const token = str(body.token)?.toLowerCase() ?? "";
    const kind = str(body.kind) as DeviceKind;
    const env = body.env === "sandbox" ? "sandbox" : "production";
    if (!/^[0-9a-f]{32,512}$/.test(token) || !["alert", "start", "activity", "widget"].includes(kind)) return json({ error: "bad token" }, 400);
    await store.addDevice({ token, kind, env, personId: v.me.id, ref: str(body.ref)?.slice(0, 120) ?? null });
    // Home-screen web notifications on this iPhone would now arrive twice.
    if (kind === "alert") {
      for (const s of await store.pushSubs(v.me.id)) if (new URL(s.endpoint).hostname === "web.push.apple.com") await store.removePushSub(s.endpoint);
    }
    return json({ ok: true });
  }
  if (a === "devices" && b && !c && method === "DELETE") {
    const kind = new URL(req.url).searchParams.get("kind") as DeviceKind;
    if (["alert", "start", "activity", "widget"].includes(kind)) await store.removeDevice(b.toLowerCase(), kind);
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}

async function handle(req: Request, ctx: Ctx, method: string): Promise<Response> {
  const { path } = await ctx.params;
  const pid = await currentPersonId();
  if (!pid) return json({ error: "signed out" }, 401);
  const v: Viewer = { me: person(pid), them: otherOf(pid) };
  try {
    return await route(v, method, path, req);
  } catch (e) {
    if (e instanceof ops.OpError) return json({ error: e.code }, e.status);
    console.error("api", method, path.join("/"), e);
    return json({ error: "server" }, 500);
  }
}

export const GET = (req: Request, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: Request, ctx: Ctx) => handle(req, ctx, "POST");
export const PATCH = (req: Request, ctx: Ctx) => handle(req, ctx, "PATCH");
export const DELETE = (req: Request, ctx: Ctx) => handle(req, ctx, "DELETE");
