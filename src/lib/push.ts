import webpush from "web-push";
import { isDeadToken, sendApns, type ApnsRequest } from "./apns";
import { apnsConfigured, isDemo, person, pushConfigured } from "./config";
import { getStore } from "./store";
import type { Device, Road } from "./types";

let configured = false;
function setup(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:hello@example.com",
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    configured = true;
  }
  return true;
}

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  badge?: number;
  tag?: string;
  /** A proposal can be answered straight from the notification on iPhone. */
  category?: "proposal";
  planId?: string;
};

async function webPush(personId: string, msg: PushMessage): Promise<void> {
  if (!setup()) return;
  const store = await getStore();
  const subs = await store.pushSubs(personId);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(msg), { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await store.removePushSub(s.endpoint);
        else console.error("push failed", code, e);
      }
    }),
  );
}

/** Send to Apple and forget any tokens Apple says are gone. Returns the tokens that went through. */
async function deliver(devices: Device[], build: (d: Device) => Omit<ApnsRequest, "token" | "env">): Promise<Device[]> {
  if (!devices.length || !apnsConfigured()) return [];
  const store = await getStore();
  let results;
  try {
    results = await sendApns(devices.map((d) => ({ ...build(d), token: d.token, env: d.env })));
  } catch (e) {
    console.error("apns failed", e);
    return [];
  }
  const ok: Device[] = [];
  await Promise.all(
    results.map(async (r, i) => {
      const d = devices[i];
      if (r.status === 200) ok.push(d);
      else if (isDeadToken(r)) await store.removeDevice(d.token, d.kind);
      else console.error("apns", d.kind, r.status, r.reason);
    }),
  );
  return ok;
}

async function apnsAlert(personId: string, msg: PushMessage): Promise<void> {
  const store = await getStore();
  const devices = await store.devices(personId, "alert");
  await deliver(devices, () => ({
    pushType: "alert",
    priority: 10,
    collapseId: msg.tag,
    expiration: Math.floor(Date.now() / 1000) + 86400,
    payload: {
      aps: {
        alert: msg.body ? { title: msg.title, body: msg.body } : { title: msg.title },
        sound: "default",
        ...(msg.badge !== undefined ? { badge: msg.badge } : {}),
        ...(msg.category === "proposal" ? { category: "PROPOSAL" } : {}),
        ...(msg.tag ? { "thread-id": msg.tag } : {}),
        // Wakes the app so it can refresh its widgets.
        "content-available": 1,
      },
      ...(msg.planId ? { planId: msg.planId } : {}),
      ...(msg.url ? { url: msg.url } : {}),
    },
  }));
}

/** Send a notification to every device a person has turned notifications on for. */
export async function notify(personId: string, msg: PushMessage, opts: { iphone?: boolean } = {}): Promise<void> {
  if (isDemo()) return;
  await Promise.all([webPush(personId, msg), opts.iphone === false ? null : apnsAlert(personId, msg)]);
}

/** How many proposals are waiting on this person (for the app icon badge). */
export async function pendingCount(personId: string): Promise<number> {
  const store = await getStore();
  const plans = await store.plans();
  return plans.filter((p) => p.status === "proposed" && p.proposedBy !== personId).length;
}

// ── Widgets ───────────────────────────────────────────────────────────

/** Ask both phones to redraw their widgets. Apple rations these, so it's a nudge, not a promise. */
export async function refreshWidgets(personIds: string[]): Promise<void> {
  if (isDemo() || !apnsConfigured()) return;
  const store = await getStore();
  const devices = (await Promise.all(personIds.map((id) => store.devices(id, "widget")))).flat();
  await deliver(devices, () => ({ pushType: "widgets", priority: 10, payload: { aps: { "content-changed": true } } }));
}

// ── "On the way" Live Activity ────────────────────────────────────────

/** Swift decodes these with its default JSON rules, so times are plain Unix seconds. */
export function roadState(road: Road, arrived = false) {
  return { leftAt: road.leftAt / 1000, eta: road.eta / 1000, arrived };
}

export function roadAttributes(road: Road, hostId: string) {
  const t = person(road.personId);
  const h = person(hostId);
  return { travelerId: t.id, traveler: t.name, host: h.name, city: h.home };
}

export const roadKey = (road: Road) => `${road.planId}:${road.leftAt}`;

/** Start the Live Activity on these people's phones. Returns who got one. */
export async function liveStart(personIds: string[], road: Road, hostId: string, alertFor: (id: string) => { title: string; body: string }): Promise<Set<string>> {
  if (isDemo() || !apnsConfigured()) return new Set();
  const store = await getStore();
  const devices = (await Promise.all(personIds.map((id) => store.devices(id, "start")))).flat();
  const now = Math.floor(Date.now() / 1000);
  const ok = await deliver(devices, (d) => ({
    pushType: "liveactivity",
    priority: 10,
    payload: {
      aps: {
        timestamp: now,
        event: "start",
        "input-push-token": 1,
        "attributes-type": "RoadAttributes",
        attributes: roadAttributes(road, hostId),
        "content-state": roadState(road),
        "stale-date": Math.floor(road.eta / 1000) + 45 * 60,
        "relevance-score": 100,
        alert: { ...alertFor(d.personId), sound: "default" },
      },
    },
  }));
  return new Set(ok.map((d) => d.personId));
}

/** Move the arrival time on every running Live Activity. */
export async function liveUpdate(personIds: string[], road: Road, alertFor?: (id: string) => { title: string; body: string } | null): Promise<Set<string>> {
  if (isDemo() || !apnsConfigured()) return new Set();
  const store = await getStore();
  const devices = (await Promise.all(personIds.map((id) => store.devices(id, "activity")))).flat();
  const now = Math.floor(Date.now() / 1000);
  const ok = await deliver(devices, (d) => {
    const alert = alertFor?.(d.personId);
    return {
      pushType: "liveactivity",
      priority: 10,
      payload: {
        aps: {
          timestamp: now,
          event: "update",
          "content-state": roadState(road),
          "stale-date": Math.floor(road.eta / 1000) + 45 * 60,
          ...(alert ? { alert: { ...alert, sound: "default" } } : {}),
        },
      },
    };
  });
  return new Set(ok.map((d) => d.personId));
}

/** End every running Live Activity; it lingers as "Here" for a few minutes. */
export async function liveEnd(personIds: string[], road: Road, arrived: boolean): Promise<void> {
  if (isDemo()) return;
  const store = await getStore();
  if (apnsConfigured()) {
    const devices = (await Promise.all(personIds.map((id) => store.devices(id, "activity")))).flat();
    const now = Math.floor(Date.now() / 1000);
    await deliver(devices, () => ({
      pushType: "liveactivity",
      priority: 10,
      payload: {
        aps: {
          timestamp: now,
          event: "end",
          "content-state": roadState(road, arrived),
          "dismissal-date": arrived ? now + 15 * 60 : now,
        },
      },
    }));
  }
  await store.removeDevicesOfKind("activity");
}
