import { ProposeForm } from "@/components/ProposeForm";
import { DRIVE_MINUTES, TZ } from "@/lib/config";
import { addDays, isDay, today, weekendFriday } from "@/lib/dates";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Search = { kind?: string; start?: string; end?: string; error?: string };

export default async function ProposePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { me, them } = await requireViewer();
  const q = await searchParams;
  const store = await getStore();
  const s = await store.settings(me.id);
  const todayStr = today(TZ);
  let fri = weekendFriday(todayStr);
  if (fri < todayStr) fri = addDays(fri, 7);
  const start = isDay(q.start) && q.start >= todayStr ? q.start : fri;
  const end = isDay(q.end) && q.end >= start ? q.end : addDays(start, 2);
  const kind = q.kind === "trip" || q.kind === "visit-me" ? q.kind : "visit-them";

  return (
    <ProposeForm
      initialKind={kind}
      start={start}
      end={end}
      minDay={todayStr}
      me={{ name: me.name, home: me.home }}
      them={{ name: them.name, home: them.home }}
      savedTitle={s.eventTitle}
      eventPrivate={s.eventPrivate}
      includeDrive={s.includeDrive}
      driveMinutes={DRIVE_MINUTES}
      error={q.error === "dates" ? "Those dates don’t quite work. Pick a start today or later, an end after it, and no more than a month." : null}
    />
  );
}
