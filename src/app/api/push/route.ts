import { NextResponse } from "next/server";
import { pendingCount } from "@/lib/push";
import { currentPersonId } from "@/lib/session";
import { getStore } from "@/lib/store";

type Body = {
  action?: "subscribe" | "unsubscribe" | "badge";
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
};

export async function POST(req: Request) {
  const pid = await currentPersonId();
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!pid) {
    // The badge check runs on every page, including the welcome screen.
    if (body.action === "badge") return NextResponse.json({ count: 0 });
    return NextResponse.json({ error: "signed out" }, { status: 401 });
  }
  const store = await getStore();
  const sub = body.subscription;

  if (body.action === "badge") {
    return NextResponse.json({ count: await pendingCount(pid) });
  }
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint)) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  if (body.action === "unsubscribe") {
    await store.removePushSub(sub.endpoint);
    return NextResponse.json({ ok: true });
  }
  if (!sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  await store.addPushSub({ endpoint: sub.endpoint, personId: pid, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return NextResponse.json({ ok: true });
}
