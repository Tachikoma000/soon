import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SignalControl } from "@/components/client";
import { ChevronLeft } from "@/components/Icons";
import { SunMark } from "@/components/Sunflower";
import { loadWeekend } from "@/lib/data";
import { DOW_LONG, dow, isDay, weekendFriday } from "@/lib/dates";
import { planName } from "@/lib/plans";
import { requireViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const AXIS = [
  ["8a", 0],
  ["12p", 26.67],
  ["4p", 53.33],
  ["8p", 80],
  ["11p", 100],
] as const;

export default async function WeekendPage({ params }: { params: Promise<{ fri: string }> }) {
  const { fri } = await params;
  if (!isDay(fri)) notFound();
  if (dow(fri) !== 5) redirect(`/weekend/${weekendFriday(fri)}`);
  const { me, them } = await requireViewer();
  const w = await loadWeekend({ me, them }, fri);

  let status: string | null = null;
  let sun = false;
  if (w.planned) {
    sun = true;
    status = w.planned.kind === "trip" ? planName(w.planned) : w.planned.host === me.id ? `${them.name}’s here` : `You’re in ${them.home}`;
  } else if (w.pending) {
    status = w.pending.proposedBy === me.id ? `Waiting on ${them.name}` : `${them.name} asked about this one`;
  } else if (w.allFree) {
    sun = true;
    status = "You’re both free";
  } else if (w.weekendFree) {
    sun = true;
    status = "Free Saturday and Sunday";
  }

  return (
    <>
      <main className="screen screen--footer" style={{ gap: 26 }}>
        <Link href="/" className="back">
          <ChevronLeft /> Soon
        </Link>

        <header className="stack" style={{ gap: 12 }}>
          <h1 className="display">{w.range}</h1>
          {status && (
            <p className="status">
              {sun && <SunMark size={18} />}
              {status}
            </p>
          )}
        </header>

        <section aria-label="Day by day">
          {w.days.map((d) => (
            <div key={d.day} className="day">
              <div className="day__head">
                <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                  <h2 className="h2">{DOW_LONG[d.dow]}</h2>
                  <p className="small muted">{d.summary}</p>
                </div>
                {d.me.state !== "p" && <SignalControl day={d.day} value={d.me.signal} label={`You on ${DOW_LONG[d.dow]}`} />}
              </div>
              <div className="lanes">
                <span className="small muted">You</span>
                <div className={`lane ${d.me.state === "p" ? "lane--p" : "lane--me"}`}>
                  {d.me.lane.map((b, i) => (
                    <span key={i} className="lane__block" style={{ left: `${b.left}%`, width: `${b.width}%` }} />
                  ))}
                </div>
                <span className="small muted">{them.name}</span>
                <div className={`lane ${d.them.state === "p" ? "lane--p" : "lane--them"}`}>
                  {d.them.lane.map((b, i) => (
                    <span key={i} className="lane__block" style={{ left: `${b.left}%`, width: `${b.width}%` }} />
                  ))}
                </div>
                <span />
                <div className="axis" aria-hidden="true">
                  {AXIS.map(([label, left]) => (
                    <span key={label} style={{ left: `${left}%` }}>{label}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      {!w.planned && !(w.pending && w.pending.proposedBy === me.id) && (
        <footer className="footer-bar">
          {w.pending ? (
            <Link href="/" className="btn btn--block btn--quiet">Answer {them.name}</Link>
          ) : (
            <Link href={`/propose?kind=visit-them&start=${w.fri}&end=${w.sun}`} className="btn btn--block">
              Ask {them.name}
            </Link>
          )}
        </footer>
      )}
    </>
  );
}
