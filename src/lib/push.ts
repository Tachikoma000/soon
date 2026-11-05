import webpush from "web-push";
import { isDemo, pushConfigured } from "./config";
import { getStore } from "./store";

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

export type PushMessage = { title: string; body: string; url?: string; badge?: number; tag?: string };

/** Send a notification to every device a person has turned notifications on for. */
export async function notify(personId: string, msg: PushMessage): Promise<void> {
  if (isDemo() || !setup()) return;
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

/** How many proposals are waiting on this person (for the app icon badge). */
export async function pendingCount(personId: string): Promise<number> {
  const store = await getStore();
  const plans = await store.plans();
  return plans.filter((p) => p.status === "proposed" && p.proposedBy !== personId).length;
}
