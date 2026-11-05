import Link from "next/link";
import { clearRoad, leaveNow } from "@/app/actions";
import { ActionButton, AnswerProposal, AutoRefresh } from "@/components/client";
import { ChevronRight, RouteIcon, SlidersIcon } from "@/components/Icons";
import { Sunflower, SunMark } from "@/components/Sunflower";
import { TZ } from "@/lib/config";
import { loadHome } from "@/lib/data";
import { DOW_LONG, addDays, dow, fmtDayRange, fmtFriendlyDay, fmtTime, zoned } from "@/lib/dates";
import { acceptLabel, bloomFor, countdownPhrase, proposalHeadline, whereLine } from "@/lib/plans";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ yes?: string }> }) {
  const { me, them } = await requireViewer();
  const d = await loadHome({ me, them });
  const { yes } = await searchParams;
  const justAccepted = yes ? await (await getStore()).plan(yes) : null;
  const incoming = d.incoming[0] ?? null;
  const n = d.heroDays;

  return (
    <main className="screen">
      <header className="topbar">
        <span className="wordmark">
          <SunMark size={20} />
          soon
        </span>
        <Link href="/settings" className="icon-btn" aria-label="Settings" style={{ marginRight: -10 }}>
          <SlidersIcon />
        </Link>
      </header>

      {!d.meConnected && (
        <a href="/api/auth/google" className="notice">
          Your calendar got disconnected. <u>Reconnect</u>
        </a>
      )}
      {d.meConnected && !d.themConnected && (
        <Link href="/settings#invite" className="notice">
          {them.name} hasn’t joined yet. <u>Send the invite</u>
        </Link>
      )}

      {justAccepted?.status === "accepted" && (
        <section className="rise" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
          <Sunflower bloom={1} size={92} sway label="A sunflower in full bloom" />
          <h1 className="title" style={{ fontSize: 40, marginTop: 6 }}>It’s a plan.</h1>
          <p className="lede">See you {fmtFriendlyDay(justAccepted.startDay)}.</p>
        </section>
      )}

      {d.road && (
        <section className="road rise" aria-live="polite">
          <AutoRefresh />
          <h2 className="h2" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RouteIcon />
            {d.road.personId === me.id ? "On your way" : `${them.name}’s on the way`}
          </h2>
          <p style={{ fontSize: 15.5 }}>There around {fmtTime(zoned(d.road.eta, TZ).minutes)}.</p>
          <div className="road__line" aria-hidden="true">
            <div className="road__track" />
            <div
              className="road__dot"
              style={{ left: `${Math.round(Math.max(0, Math.min(1, (Date.now() - d.road.leftAt) / (d.road.eta - d.road.leftAt))) * 100)}%` }}
            />
            <span className="road__end"><SunMark size={22} /></span>
          </div>
          {d.road.personId === me.id && (
            <ActionButton action={clearRoad} className="btn btn--fern">
              I’m here
            </ActionButton>
          )}
        </section>
      )}

      {incoming && (
        <section className="card rise" aria-labelledby="incoming-title">
          <h2 id="incoming-title" className="title" style={{ fontSize: 30 }}>
            {proposalHeadline(incoming, me)}
          </h2>
          <p style={{ fontSize: 16.5, marginTop: -6 }}>{fmtDayRange(incoming.startDay, incoming.endDay)}</p>
          {incoming.note && (
            <p className="hand" style={{ fontSize: 28, transform: "rotate(-1.2deg)", transformOrigin: "left center" }}>
              “{incoming.note}”
            </p>
          )}
          {d.incomingNote && <p className="small muted">{d.incomingNote}</p>}
          <AnswerProposal planId={incoming.id} acceptLabel={acceptLabel(incoming, me)} />
        </section>
      )}

      {d.hero && n !== null ? (
        <section className="hero rise rise-2" aria-labelledby="hero-title">
          <div className="hero__top">
            <h1 id="hero-title" className="hero__count">
              {n > 0 ? (
                <>
                  {n}
                  <small>{n === 1 ? "day" : "days"}</small>
                </>
              ) : (
                <span className="hero__word">{n === 0 ? "Today" : "Together"}</span>
              )}
            </h1>
            <Sunflower bloom={bloomFor(n)} size={96} sway className="hero__flower" />
          </div>
          <p className="hero__until">
            {n > 0
              ? countdownPhrase(d.hero, me)
              : n === 0
                ? d.hero.kind === "trip"
                  ? `${d.hero.title || "Our trip"} starts`
                  : `you’ll see ${them.name}`
                : `until ${DOW_LONG[dow(d.hero.endDay)]}`}
          </p>
          <p className="small muted">
            {whereLine(d.hero, me)} · {fmtDayRange(d.hero.startDay, d.hero.endDay)}
          </p>
          {d.canLeave && (
            <div style={{ marginTop: 14 }}>
              <ActionButton action={leaveNow.bind(null, d.hero.id)} className="btn btn--block btn--fern">
                <RouteIcon size={20} /> Leaving now
              </ActionButton>
            </div>
          )}
        </section>
      ) : d.nextFree ? (
        <section className="hero rise rise-2" aria-labelledby="hero-title">
          <div className="hero__top">
            <h1 id="hero-title" className="display" style={{ fontSize: 52 }}>{d.nextFree.range}</h1>
            <Sunflower bloom={1} size={64} stem={false} className="hero__flower" />
          </div>
          <p className="lede">You’re both free.</p>
          <Link href={`/propose?start=${d.nextFree.fri}&end=${addDays(d.nextFree.fri, 2)}`} className="btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            Ask {them.name}
          </Link>
        </section>
      ) : (
        <section className="hero rise rise-2">
          <h1 className="title">No free weekends for a while.</h1>
          <Link href="/calendar" className="linkish">Look further out</Link>
        </section>
      )}

      {d.nextTrip && (
        <Link href="/plans" className="mini rise rise-3">
          <span className="list-main">
            <span className="list-title">{d.nextTrip.title || "Our trip"}</span>
            <span className="list-sub">{fmtDayRange(d.nextTrip.startDay, d.nextTrip.endDay)}</span>
          </span>
          <span className="mini__num">
            {d.nextTripDays}
            <small>{d.nextTripDays === 1 ? "day" : "days"}</small>
          </span>
        </Link>
      )}

      <section className="section rise rise-3" aria-labelledby="weekends">
        <h2 id="weekends" className="h2">Weekends</h2>
        <div>
          {d.rows.map((r) => (
            <Link key={r.fri} href={`/weekend/${r.fri}`} className="list-row">
              <span className="list-main">
                <span className="list-title">
                  {r.range}
                  {(r.open || r.planned) && <SunMark />}
                </span>
                <span className="list-sub">{r.note}</span>
              </span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
