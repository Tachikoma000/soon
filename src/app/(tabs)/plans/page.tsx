import Link from "next/link";
import { acceptPlan, cancelPlan, declinePlan } from "@/app/actions";
import { ActionButton, ConfirmButton } from "@/components/client";
import { ChevronRight, PlusIcon } from "@/components/Icons";
import { Sunflower } from "@/components/Sunflower";
import { loadPlans } from "@/lib/data";
import { daysBetween, fmtDayRange, fmtRange } from "@/lib/dates";
import { planName } from "@/lib/plans";
import { requireViewer } from "@/lib/session";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const { me, them } = await requireViewer();
  const d = await loadPlans({ me, them });
  const ahead = [...d.waiting, ...d.upcoming].sort((a, b) => a.startDay.localeCompare(b.startDay));
  const nothing = !d.incoming.length && !ahead.length && !d.past.length;

  const when = (p: Plan) => {
    if (p.status === "proposed") return `waiting on ${them.name}`;
    const n = daysBetween(d.todayStr, p.startDay);
    return n > 1 ? `in ${n} days` : n === 1 ? "tomorrow" : n === 0 ? "today" : "now";
  };

  return (
    <main className="screen">
      <header className="row-between" style={{ alignItems: "center" }}>
        <h1 className="title" style={{ fontSize: 36 }}>Plans</h1>
        <Link href="/propose" className="icon-btn icon-btn--filled" aria-label="New plan" style={{ marginRight: -4 }}>
          <PlusIcon />
        </Link>
      </header>

      {nothing && (
        <section className="stack-lg" style={{ alignItems: "center", textAlign: "center", paddingTop: 48 }}>
          <Sunflower bloom={0} size={64} />
          <p className="title" style={{ fontSize: 26 }}>Nothing planned yet.</p>
          <Link href="/calendar" className="linkish" style={{ alignSelf: "center" }}>Find a weekend</Link>
        </section>
      )}

      {d.incoming.map((p) => (
        <section key={p.id} className="card" aria-label={`${them.name} asked`}>
          <div className="list-main">
            <span className="list-title">{planName(p)}</span>
            <span className="list-sub">{fmtDayRange(p.startDay, p.endDay)}</span>
          </div>
          {p.note && <p className="hand" style={{ fontSize: 24 }}>“{p.note}”</p>}
          <div className="btn-row">
            <ActionButton action={acceptPlan.bind(null, p.id, null)}>Yes</ActionButton>
            <ActionButton action={declinePlan.bind(null, p.id)} className="btn btn--quiet">Not then</ActionButton>
          </div>
        </section>
      ))}

      {ahead.length > 0 && (
        <section aria-label="Coming up">
          {ahead.map((p) => (
            <details key={p.id} className="more" style={{ borderBottom: 0 }}>
              <summary style={{ padding: "13px 0", alignItems: "center" }}>
                <span className="list-main">
                  <span className="list-title">{planName(p)}</span>
                  <span className="list-sub">
                    {fmtDayRange(p.startDay, p.endDay)} · {when(p)}
                  </span>
                </span>
                <ChevronRight size={16} />
              </summary>
              <div className="more__body" style={{ gap: 0 }}>
                {p.note && <p className="small muted" style={{ marginBottom: 2 }}>“{p.note}”</p>}
                <ConfirmButton
                  action={cancelPlan.bind(null, p.id)}
                  message={
                    p.status === "proposed"
                      ? `Take back ${fmtRange(p.startDay, p.endDay)}?`
                      : `Cancel ${fmtRange(p.startDay, p.endDay)}? It comes off both your calendars.`
                  }
                >
                  {p.status === "proposed" ? "Take it back" : "Cancel"}
                </ConfirmButton>
              </div>
            </details>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </section>
      )}

      {d.past.length > 0 && (
        <section className="section" aria-labelledby="before">
          <h2 id="before" className="h2 faint">Before</h2>
          <div>
            {d.past.map((p) => (
              <div key={p.id} className="list-row" style={{ minHeight: 58 }}>
                <span className="list-main">
                  <span className="list-title muted" style={{ fontStyle: "italic", fontSize: 19 }}>{planName(p)}</span>
                  <span className="list-sub">{fmtRange(p.startDay, p.endDay)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
