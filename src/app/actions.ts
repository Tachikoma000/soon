"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDemo, people } from "@/lib/config";
import * as ops from "@/lib/ops";
import { requireViewer, setDemoViewer } from "@/lib/session";
import type { SignalValue } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

const clean = (v: FormDataEntryValue | null): string | null => (typeof v === "string" ? v : null);

/** Run an operation; a refusal (already answered, not yours…) is quietly ignored on the website. */
async function quietly(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    if (e instanceof ops.OpError) return false;
    throw e;
  }
}

export async function setSignal(day: string, value: SignalValue | null): Promise<void> {
  const v = await requireViewer();
  if (await quietly(() => ops.setSignal(v, day, value))) refresh();
}

export async function proposePlan(form: FormData): Promise<void> {
  const v = await requireViewer();
  const kind = form.get("kind");
  const ok = await quietly(() =>
    ops.propose(v, {
      kind: kind === "trip" ? "trip" : kind === "visit-me" ? "visit-me" : "visit-them",
      start: clean(form.get("start")) ?? "",
      end: clean(form.get("end")) ?? "",
      arrive: clean(form.get("arrive")),
      title: clean(form.get("title")),
      note: clean(form.get("note")),
      eventTitle: clean(form.get("eventTitle")),
      private: form.get("private") === "on",
      drive: form.has("drive") || form.get("driveShown") === "1" ? form.get("drive") === "on" : undefined,
    }),
  );
  if (!ok) redirect(`/propose?error=dates`);
  refresh();
  redirect("/plans");
}

export async function acceptPlan(planId: string, eventTitle?: string | null): Promise<void> {
  const v = await requireViewer();
  if (!(await quietly(() => ops.accept(v, planId, eventTitle)))) return;
  refresh();
  redirect(`/?yes=${planId}`);
}

export async function declinePlan(planId: string): Promise<void> {
  const v = await requireViewer();
  let month: string | null = null;
  if (!(await quietly(async () => (month = (await ops.decline(v, planId)).startDay.slice(0, 7))))) return;
  refresh();
  redirect(`/calendar?m=${month}`);
}

export async function cancelPlan(planId: string): Promise<void> {
  const v = await requireViewer();
  if (await quietly(() => ops.cancel(v, planId))) refresh();
}

export async function leaveNow(planId: string): Promise<void> {
  const v = await requireViewer();
  if (await quietly(() => ops.leave(v, planId))) refresh();
}

export async function clearRoad(): Promise<void> {
  const v = await requireViewer();
  await ops.arrived(v);
  refresh();
}

export async function saveSettings(form: FormData): Promise<void> {
  const v = await requireViewer();
  await ops.saveSettings(v, {
    eventTitle: clean(form.get("eventTitle")),
    eventPrivate: form.get("private") === "on",
    includeDrive: form.get("drive") === "on",
    ...(form.get("calendarsShown") === "1" ? { calendars: form.getAll("calendars").filter((x): x is string => typeof x === "string") } : {}),
  });
  refresh();
  redirect("/settings?saved=1");
}

export async function finishOnboarding(): Promise<void> {
  const v = await requireViewer();
  await ops.finishOnboarding(v);
  redirect("/");
}

/**
 * Turn "Let them see what's on my calendar" on or off.
 * Turning it on needs one more Google permission; if we don't have it yet, the page sends you to Google.
 */
export async function setShareDetails(on: boolean): Promise<"ok" | "consent"> {
  const v = await requireViewer();
  const r = await ops.setShareDetails(v, on);
  if (r === "ok") refresh();
  return r;
}

/** A one-time link for the other person to join with whichever Google account they like. */
export async function createInvite(): Promise<string | null> {
  const v = await requireViewer();
  return ops.createInvite(v);
}

export async function enterDemo(id: string): Promise<void> {
  if (!isDemo() || !people().some((p) => p.id === id)) return;
  await setDemoViewer(id);
  redirect("/");
}
