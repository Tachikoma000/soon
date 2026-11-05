import Link from "next/link";
import { clearRoad, leaveNow } from "./actions";
import { ActionButton, AnswerProposal, AutoRefresh } from "@/components/client";
import { DotKey, WeekendDots } from "@/components/Dots";
import { ArrowRight, ChevronRight, RouteIcon, SlidersIcon } from "@/components/Icons";
import { Sunflower, SunMark } from "@/components/Sunflower";
import { TabBar } from "@/components/TabBar";
import { DRIVE_MINUTES, TZ } from "@/lib/config";
import { loadHome } from "@/lib/data";
import { fmtDay, fmtDayRange, fmtDuration, fmtRange, fmtTime, hhmmToMinutes, zoned } from "@/lib/dates";
import { acceptLabel, bloomFor, countdownPhrase, defaultEventTitle, planName, proposalHeadline } from "@/lib/plans";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ yes?: string }> }) {
  const { me, them } = await requireViewer();
  const d = await loadHome({ me, them });
  const { yes } = await searchParams;
  const store = await getStore();
  const justAccepted = yes ? await store.plan(yes) : null;

  const incoming = d.incoming[0] ?? null;
  const titleOptions = incoming
    ? [...new Set([d.myDefaultTitle, defaultEventTitle(incoming, me.id), "Busy", "Personal"].filter((x): x is string => !!x))].slice(0, 4)
    : [];

  return (
    <>
      <main className="screen">
        <header className="topbar">
          <span className="wordmark">
            <SunMark size={20} />
            soon
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="legend">
              <span><span className="swatch swatch--me" />You</span>
              <span><span className="swatch swatch--them" />{them.name}</span>
            </div>
            <Link href="/settings" className="icon-btn" aria-label="Settings" style={{ marginRight: -10 }}>
              <SlidersIcon />
            </Link>
          </div>
        </header>

        {!d.meConnected && (
          <div className="notice">
            <span>
              <strong>Your calendar isn’t connected.</strong> Soon can’t see when you’re busy.{" "}
              <a href="/api/auth/google">Connect Google</a>
            </span>
          </div>
        )}
        {d.meConnected && !d.themConnected && (
          <div className="notice">
            <span>
              <strong>{them.name} hasn’t connected yet.</strong> Until then, {them.name}’s days show as free.
            </span>
          </div>
        )}

        {justAccepted && justAccepted.status === "accepted" && (
          <section className="hero rise" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
            <Sunflower bloom={1} size={96} sway label="A sunflower in full bloom" />
            <h1 className="title" style={{ fontSize: 40 }}>It’s a plan.</h1>
            <p className="lede" style={{ maxWidth: "30ch" }}>
              {fmtRange(justAccepted.startDay, justAccepted.endDay)} is on both your calendars, and {them.name} just got the good news.
            </p>
          </section>
        )}

        {d.road && (
          <section className="road rise" aria-live="polite">
            <AutoRefresh />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RouteIcon />
              <h2 className="serif" style={{ fontSize: 22 }}>
                {d.road.personId === me.id ? "You’re on the way" : `${them.name}’s on the way`}
              </h2>
            </div>
            <p style={{ fontSize: 15 }}>There around {fmtTime(zoned(d.road.eta, TZ).minutes)}.</p>
            <div className="road__line" aria-hidden="true">
              <div className="road__track" />
              <div
                className="road__dot"
                style={{ left: `${Math.round(Math.max(0, Math.min(1, (Date.now() - d.road.leftAt) / (d.road.eta - d.road.leftAt))) * 100)}%` }}
              />
              <span className="road__end"><SunMark size={22} /></span>
            </div>
            {d.road.personId === me.id && (
              <ActionButton action={clearRoad} className="btn btn--fern" pendingText="Telling them…">
                I’m here
              </ActionButton>
            )}
          </section>
        )}

        {incoming && (
          <section className="card card--sun rise" aria-labelledby="incoming-title">
            <p className="eyebrow">From {them.name}</p>
            <h2 id="incoming-title" className="title" style={{ fontSize: 31 }}>
              {proposalHeadline(incoming, me)}
            </h2>
            <div className="stack" style={{ gap: 4 }}>
              <p style={{ fontSize: 17 }}>{incoming.kind === "trip" ? incoming.title : null}{incoming.kind === "trip" ? " · " : ""}{fmtDayRange(incoming.startDay, incoming.endDay)}</p>
              {incoming.kind === "visit" && (
                <p className="small muted">
                  {incoming.host === me.id ? "Arriving" : "Arrive"} around {fmtTime(hhmmToMinutes(incoming.arriveTime, 1050))} on {fmtDay(incoming.startDay).split(",")[0]}.
                </p>
              )}
            </div>
            {incoming.note && (
              <p className="hand" style={{ fontSize: 28, transform: "rotate(-1.2deg)", transformOrigin: "left center" }}>
                “{incoming.note}”
              </p>
            )}
            {d.incomingDays.length > 0 && (
              <div className="section">
                <p className="eyebrow">Your days</p>
                {d.incomingDays.map((x, i) => (
                  <div key={x.day} className={`row-between${i === d.incomingDays.length - 1 ? " list-end" : ""}`} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                    <span className="serif" style={{ fontSize: 18 }}>{fmtDay(x.day).split(",")[0]}</span>
                    <span className="small muted">{x.line}</span>
                  </div>
                ))}
              </div>
            )}
            <AnswerProposal planId={incoming.id} titles={titleOptions} acceptLabel={acceptLabel(incoming, me)} />
          </section>
        )}

        {d.hero ? (
          <section className="hero rise rise-2" aria-labelledby="hero-title">
            <p className="eyebrow">{d.hero.kind === "trip" ? "Next trip" : "Next visit"}</p>
            <div className="hero__top">
              <h1 id="hero-title" className="hero__count">
                {d.heroDays! > 0 ? (
                  <>
                    {d.heroDays}
                    <small>{d.heroDays === 1 ? "day" : "days"}</small>
                  </>
                ) : d.heroDays === 0 ? (
                  <span style={{ fontSize: 72 }}>Today</span>
                ) : (
                  <span style={{ fontSize: 64 }}>Together</span>
                )}
              </h1>
              <Sunflower bloom={bloomFor(d.heroDays!)} size={100} sway className="hero__flower" label={d.heroDays! > 0 ? `A sunflower, ${Math.round(bloomFor(d.heroDays!) * 100)}% open` : "A sunflower in full bloom"} />
            </div>
            <p className="hero__until">
              {d.heroDays! > 0
                ? countdownPhrase(d.hero, me)
                : d.heroDays === 0
                  ? d.hero.kind === "trip"
                    ? `${d.hero.title || "Your trip"} starts today`
                    : d.hero.host === me.id
                      ? `${them.name} gets here today`
                      : `You’re seeing ${them.name} today`
                  : `through ${fmtDay(d.hero.endDay)}`}
            </p>
            <p className="small muted">
              {fmtDayRange(d.hero.startDay, d.hero.endDay)}
              {d.hero.kind === "visit" && d.heroDays! >= 0 && ` · there around ${fmtTime(hhmmToMinutes(d.hero.arriveTime, 1050))}`}
            </p>
            {d.canLeave && (
              <div className="stack" style={{ marginTop: 6 }}>
                <ActionButton action={leaveNow.bind(null, d.hero.id)} className="btn btn--block btn--fern" pendingText="Letting them know…">
                  <RouteIcon size={20} /> Leaving now
                </ActionButton>
                <p className="small faint">{them.name} gets a note that you’re about {fmtDuration(DRIVE_MINUTES)} out.</p>
              </div>
            )}
          </section>
        ) : d.nextFree ? (
          <section className="hero rise rise-2" aria-labelledby="hero-title">
            <p className="eyebrow">Next weekend you’re both free</p>
            <div className="hero__top">
              <h1 id="hero-title" className="display" style={{ fontSize: 50 }}>{d.nextFree.range}</h1>
              <Sunflower bloom={1} size={70} stem={false} className="hero__flower" />
            </div>
            <p className="lede" style={{ maxWidth: "30ch" }}>{d.nextFree.note}.</p>
            <Link href={`/weekend/${d.nextFree.fri}`} className="btn" style={{ alignSelf: "flex-start" }}>
              Plan a visit <ArrowRight />
            </Link>
          </section>
        ) : (
          <section className="hero rise rise-2">
            <p className="eyebrow">Nothing planned yet</p>
            <h1 className="title">No weekend’s fully open in the next six.</h1>
            <Link href="/calendar" className="btn" style={{ alignSelf: "flex-start" }}>
              Look further out <ArrowRight />
            </Link>
          </section>
        )}

        {(d.nextTrip || (d.hero && d.nextFree) || d.waiting.length > 0) && (
          <section className="section rise rise-3" aria-label="Also coming up">
            {d.nextTrip && (
              <Link href="/plans" className="mini">
                <span className="mini__label">
                  <span className="eyebrow">Next trip</span>
                  <span className="list-title">{d.nextTrip.title || "Trip together"}</span>
                  <span className="list-sub">{fmtDayRange(d.nextTrip.startDay, d.nextTrip.endDay)}</span>
                </span>
                <span className="mini__num">
                  {d.nextTripDays}
                  <small>{d.nextTripDays === 1 ? "day" : "days"}</small>
                </span>
              </Link>
            )}
            {d.hero && d.nextFree && (
              <Link href={`/weekend/${d.nextFree.fri}`} className="mini">
                <span className="mini__label">
                  <span className="eyebrow">Next free weekend</span>
                  <span className="list-title">
                    {d.nextFree.range} <SunMark />
                  </span>
                  <span className="list-sub">{d.nextFree.note}</span>
                </span>
                <ChevronRight />
              </Link>
            )}
            {d.waiting.map((p) => (
              <Link key={p.id} href="/plans" className="mini">
                <span className="mini__label">
                  <span className="eyebrow">Waiting on {them.name}</span>
                  <span className="list-title">{planName(p)}</span>
                  <span className="list-sub">{fmtDayRange(p.startDay, p.endDay)}</span>
                </span>
                <span className="pill pill--wait">Waiting</span>
              </Link>
            ))}
            <div className="list-end" />
          </section>
        )}

        <section className="section" aria-labelledby="weekends">
          <h2 id="weekends" className="eyebrow">Coming weekends</h2>
          {d.rows.map((r) => (
            <Link key={r.fri} href={`/weekend/${r.fri}`} className="list-row">
              <span className="list-main">
                <span className="list-title">
                  {r.range}
                  {r.open && <SunMark />}
                </span>
                <span className="list-sub">{r.note}</span>
              </span>
              <span className="list-aside">
                <WeekendDots days={r.days} />
                <ChevronRight size={16} />
              </span>
            </Link>
          ))}
          <div className="list-end" />
          <DotKey />
        </section>
      </main>
      <TabBar current="home" badge={d.incoming.length} />
    </>
  );
}
