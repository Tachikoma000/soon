import Link from "next/link";
import { acceptPlan, cancelPlan, declinePlan } from "../actions";
import { ActionButton, ConfirmButton } from "@/components/client";
import { CheckIcon, PlusIcon } from "@/components/Icons";
import { Sunflower } from "@/components/Sunflower";
import { TabBar } from "@/components/TabBar";
import { loadPlans } from "@/lib/data";
import { daysBetween, fmtDayRange, fmtRange } from "@/lib/dates";
import { planName } from "@/lib/plans";
import { requireViewer } from "@/lib/session";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const { me, them } = await requireViewer();
  const d = await loadPlans({ me, them });
  const nothing = !d.incoming.length && !d.waiting.length && !d.upcoming.length && !d.past.length;

  const sub = (p: Plan) => {
    if (p.kind === "trip") return p.note || "A trip together";
    return p.host === me.id ? `${them.name} comes to you` : `You go to ${them.name}’s`;
  };

  return (
    <>
      <main className="screen">
        <header className="row-between" style={{ alignItems: "center" }}>
          <h1 className="title" style={{ fontSize: 36 }}>Plans</h1>
          <Link href="/propose" className="icon-btn icon-btn--filled" aria-label="New plan" style={{ marginRight: -4 }}>
            <PlusIcon />
          </Link>
        </header>

        {nothing && (
          <section className="stack-lg" style={{ alignItems: "center", textAlign: "center", paddingTop: 40 }}>
            <Sunflower bloom={0} size={70} />
            <p className="title" style={{ fontSize: 26 }}>Nothing planned yet.</p>
            <Link href="/calendar" className="btn">Find a weekend</Link>
          </section>
        )}

        {d.incoming.length > 0 && (
          <section className="section" aria-labelledby="needs">
            <h2 id="needs" className="eyebrow">Needs your answer</h2>
            {d.incoming.map((p) => (
              <div key={p.id} className="list-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 12 }}>
                <span className="list-main">
                  <span className="list-title">{planName(p)}</span>
                  <span style={{ fontSize: 14.5 }}>{fmtDayRange(p.startDay, p.endDay)}</span>
                  <span className="list-sub">{p.note ? `“${p.note}” · ` : ""}from {them.name}</span>
                </span>
                <div className="btn-row" style={{ width: "100%" }}>
                  <ActionButton action={acceptPlan.bind(null, p.id, null)} pendingText="Adding…">Yes</ActionButton>
                  <ActionButton action={declinePlan.bind(null, p.id)} className="btn btn--quiet">Other dates</ActionButton>
                </div>
              </div>
            ))}
            <div className="list-end" />
          </section>
        )}

        {d.waiting.length > 0 && (
          <section className="section" aria-labelledby="waiting">
            <h2 id="waiting" className="eyebrow">Waiting on {them.name}</h2>
            {d.waiting.map((p) => (
              <div key={p.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <span className="list-main">
                  <span className="list-title">{planName(p)}</span>
                  <span style={{ fontSize: 14.5 }}>{fmtDayRange(p.startDay, p.endDay)}</span>
                  <span className="list-sub">{p.note ? `“${p.note}”` : sub(p)}</span>
                  <ConfirmButton action={cancelPlan.bind(null, p.id)} message={`Take back ${fmtRange(p.startDay, p.endDay)}?`}>
                    Take it back
                  </ConfirmButton>
                </span>
                <span className="pill pill--wait">Waiting</span>
              </div>
            ))}
            <div className="list-end" />
          </section>
        )}

        {d.upcoming.length > 0 && (
          <section className="section" aria-labelledby="coming">
            <h2 id="coming" className="eyebrow">Coming up</h2>
            {d.upcoming.map((p) => {
              const n = daysBetween(d.todayStr, p.startDay);
              return (
                <div key={p.id} className="list-row" style={{ alignItems: "flex-start" }}>
                  <span className="list-main">
                    <span className="list-title">{planName(p)}</span>
                    <span style={{ fontSize: 14.5 }}>{fmtDayRange(p.startDay, p.endDay)}</span>
                    <span className="list-sub">
                      {n > 0 ? `In ${n} ${n === 1 ? "day" : "days"}` : n === 0 ? "Today" : "Happening now"} · {sub(p)}
                    </span>
                    <ConfirmButton
                      action={cancelPlan.bind(null, p.id)}
                      message={`Cancel ${fmtRange(p.startDay, p.endDay)}? It comes off both your calendars.`}
                    >
                      Cancel plan
                    </ConfirmButton>
                  </span>
                  <span className="pill pill--ok">
                    <CheckIcon size={13} /> On both calendars
                  </span>
                </div>
              );
            })}
            <div className="list-end" />
          </section>
        )}

        {d.past.length > 0 && (
          <section className="section" aria-labelledby="before">
            <h2 id="before" className="eyebrow">Last time</h2>
            {d.past.map((p) => (
              <div key={p.id} className="list-row" style={{ minHeight: 60 }}>
                <span className="list-main">
                  <span className="list-title muted" style={{ fontStyle: "italic", fontSize: 20 }}>{planName(p)}</span>
                  <span className="list-sub">
                    {fmtRange(p.startDay, p.endDay)} ·{" "}
                    {p.kind === "trip" ? p.note || "A trip together" : p.host === me.id ? `${them.name} came to you` : `You went to ${them.name}’s`}
                  </span>
                </span>
              </div>
            ))}
            <div className="list-end" />
          </section>
        )}
      </main>
      <TabBar current="plans" badge={d.incoming.length} />
    </>
  );
}
