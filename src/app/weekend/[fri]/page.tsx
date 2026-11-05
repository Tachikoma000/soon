import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SignalControl } from "@/components/client";
import { ChevronLeft, RouteIcon } from "@/components/Icons";
import { SunMark } from "@/components/Sunflower";
import { DRIVE_MINUTES } from "@/lib/config";
import { loadWeekend } from "@/lib/data";
import { DOW_LONG, dow, fmtDuration, fmtTime, isDay, weekendFriday } from "@/lib/dates";
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

  const status = w.planned
    ? `Planned · ${planName(w.planned)}`
    : w.allFree
      ? "Open for both of you"
      : w.weekendFree
        ? "Saturday and Sunday are open"
        : "A few things in the way";
  const arrive = 17 * 60 + 30;

  return (
    <>
      <main className="screen screen--footer">
        <Link href="/" className="back">
          <ChevronLeft /> Soon
        </Link>

        <header className="stack">
          <p className="eyebrow">Friday to Sunday</p>
          <h1 className="display" style={{ fontSize: 44 }}>{w.range}</h1>
          <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15.5 }}>
            {(w.allFree || w.weekendFree || w.planned) && <SunMark size={18} />}
            {status}
          </p>
        </header>

        {w.pending && (
          <div className="notice">
            <span>
              {w.pending.proposedBy === me.id ? (
                <>
                  <strong>You’ve proposed this weekend.</strong> Waiting on {them.name}.
                </>
              ) : (
                <>
                  <strong>{them.name} proposed this weekend.</strong> <Link href="/">Answer on the home screen</Link>
                </>
              )}
            </span>
          </div>
        )}

        <section aria-label="Day by day" className="section">
          <div className="key" aria-hidden="true" style={{ paddingTop: 0, paddingBottom: 10 }}>
            <span><span style={{ width: 14, height: 9, borderRadius: 3, background: "var(--terra-soft)", display: "inline-block" }} />You, free</span>
            <span><span style={{ width: 14, height: 9, borderRadius: 3, background: "var(--fern-soft)", display: "inline-block" }} />{them.name}, free</span>
            <span><span style={{ width: 14, height: 9, borderRadius: 3, background: "var(--busy)", display: "inline-block" }} />Busy</span>
          </div>
          {w.days.map((d) => (
            <div key={d.day} className="day">
              <div className="row-between">
                <h2 className="serif" style={{ fontSize: 22 }}>{DOW_LONG[d.dow]}</h2>
                <span className="small muted" style={{ textAlign: "right" }}>{d.summary}</span>
              </div>
              <div className="lanes">
                <span className="small muted">You</span>
                <div className={`lane ${d.me.state === "p" ? "lane--p" : "lane--me"}`}>
                  {d.me.lane.map((b, i) => (
                    <span key={i} className="lane__block" style={{ left: `${b.left}%`, width: `${b.width}%` }}>{b.label}</span>
                  ))}
                </div>
                <span className="small muted">{them.name}</span>
                <div className={`lane ${d.them.state === "p" ? "lane--p" : "lane--them"}`}>
                  {d.them.lane.map((b, i) => (
                    <span key={i} className="lane__block" style={{ left: `${b.left}%`, width: `${b.width}%` }}>{b.label}</span>
                  ))}
                </div>
                <span />
                <div className="axis" aria-hidden="true">
                  {AXIS.map(([label, left]) => (
                    <span key={label} style={{ left: `${left}%` }}>{label}</span>
                  ))}
                </div>
              </div>
              {d.me.state !== "p" && (
                <SignalControl day={d.day} value={d.me.signal} label={`Your answer for ${DOW_LONG[d.dow]}`} />
              )}
            </div>
          ))}
        </section>

        {!w.planned && (
          <section className="row-between" style={{ alignItems: "flex-start", gap: 12, paddingTop: 16, borderTop: "1px solid var(--line)", justifyContent: "flex-start" }}>
            <span style={{ color: "var(--terra)", flex: "0 0 auto", marginTop: 1 }}><RouteIcon size={22} /></span>
            <p className="small muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>
              About {fmtDuration(DRIVE_MINUTES)} between {me.home} and {them.home}. Leave by {fmtTime(arrive - DRIVE_MINUTES)} to be there at {fmtTime(arrive)}.
            </p>
          </section>
        )}
      </main>

      <footer className="footer-bar">
        {w.planned ? (
          <Link href="/plans" className="btn btn--block btn--quiet">See the plan</Link>
        ) : w.pending ? (
          <Link href={w.pending.proposedBy === me.id ? "/plans" : "/"} className="btn btn--block btn--quiet">
            {w.pending.proposedBy === me.id ? "See your proposal" : `Answer ${them.name}`}
          </Link>
        ) : (
          <Link href={`/propose?kind=visit-them&start=${w.fri}&end=${w.sun}`} className="btn btn--block">
            Propose this weekend
          </Link>
        )}
      </footer>
    </>
  );
}
