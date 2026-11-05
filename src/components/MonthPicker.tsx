"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MonthCell } from "@/lib/data";
import { DOW_LONG, DOW_SHORT, addDays, daysBetween, dow, fmtDay, fmtMonthDay, fmtRange } from "@/lib/dates";
import { Dot, DotKey } from "./Dots";
import { SunMark } from "./Sunflower";

type Props = { cells: MonthCell[]; lead: number; todayStr: string; themName: string };

const WORD = { f: "free", m: "maybe", b: "busy", p: "together" } as const;

export function MonthPicker({ cells, lead, todayStr, themName }: Props) {
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const pick = (day: string) => {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  };

  const last = end ?? start;
  const byDay = useMemo(() => new Map(cells.map((c) => [c.day, c])), [cells]);

  const conflicts = useMemo(() => {
    if (!start || !end) return [];
    type Run = { who: "me" | "them"; state: "b" | "m" | "p"; from: string; to: string };
    const runs: Run[] = [];
    for (const who of ["me", "them"] as const) {
      let cur: Run | null = null;
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const c = byDay.get(d);
        const s = c?.[who];
        if (s === "b" || s === "m" || (s === "p" && who === "me")) {
          if (cur && cur.state === s && addDays(cur.to, 1) === d) cur.to = d;
          else {
            cur = { who, state: s, from: d, to: d };
            runs.push(cur);
          }
        } else cur = null;
      }
    }
    return runs
      .sort((a, b) => a.from.localeCompare(b.from))
      .map((r) => {
        const when = r.from === r.to ? fmtDay(r.from) : fmtRange(r.from, r.to);
        const text =
          r.state === "p"
            ? `Already planned ${when}`
            : r.who === "me"
              ? r.state === "b" ? `You’re busy ${when}` : `You said maybe ${when}`
              : r.state === "b" ? `${themName}’s busy ${when}` : `${themName} said maybe ${when}`;
        return { ...r, text };
      });
  }, [start, end, byDay, themName]);

  const len = start && end ? daysBetween(start, end) + 1 : 0;

  return (
    <>
      <div>
        <div className="month-head" aria-hidden="true">
          {DOW_SHORT.map((d, i) => (
            <span key={i} className={i === 0 || i >= 5 ? "wk" : undefined}>{d[0]}</span>
          ))}
        </div>
        <div className="month">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`lead-${i}`} className="cell" aria-hidden="true" />
          ))}
          {cells.map((c) => {
            const w = dow(c.day);
            const weekend = w === 0 || w >= 5;
            const inRange = !!start && c.day >= start && c.day <= (last as string);
            const isEnd = c.day === start || c.day === last;
            const past = c.day < todayStr;
            const both = c.me === "f" && c.them === "f";
            const cls = [
              "cell",
              weekend && "cell--wk",
              inRange && "cell--band",
              inRange && (c.day === start || w === 0) && "cell--l",
              inRange && (c.day === last || w === 6) && "cell--r",
              isEnd && "cell--end",
              !isEnd && weekend && both && !past && "cell--open",
              c.planned && "cell--planned",
              c.day === todayStr && "cell--today",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={c.day} className={cls}>
                <button
                  type="button"
                  disabled={past}
                  onClick={() => pick(c.day)}
                  aria-pressed={inRange}
                  aria-label={`${DOW_LONG[w]}, ${fmtMonthDay(c.day)}. You: ${WORD[c.me]}. ${themName}: ${WORD[c.them]}.`}
                >
                  <span className="cell__n">{Number(c.day.slice(8))}</span>
                  <span className="cell__dots" aria-hidden="true">
                    <Dot who="me" state={c.me} small />
                    <Dot who="them" state={c.them} small />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <DotKey
          extra={
            <span>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--sun-soft)", display: "inline-block" }} />
              Weekend you’re both free
            </span>
          }
        />
      </div>

      <section aria-live="polite" className="stack-lg" style={{ paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        {start && end ? (
          <>
            <div className="row-between">
              <h2 className="serif" style={{ fontSize: 27 }}>{start === end ? fmtDay(start) : fmtRange(start, end)}</h2>
              <span className="small muted">{len === 1 ? "1 day" : `${len} days`}</span>
            </div>
            {conflicts.length === 0 ? (
              <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
                <SunMark size={18} /> Wide open for both of you.
              </p>
            ) : (
              <div className="stack">
                <p style={{ fontSize: 15 }}>{conflicts.length === 1 ? "One thing to work around:" : `${conflicts.length} things to work around:`}</p>
                <ul className="stack" style={{ gap: 8 }}>
                  {conflicts.map((k, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, color: "var(--ink-2)" }}>
                      <Dot who={k.who} state={k.state} />
                      {k.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="btn-row">
              <Link href={`/propose?kind=trip&start=${start}&end=${end}`} className="btn">Propose a trip</Link>
              <Link href={`/propose?kind=visit-them&start=${start}&end=${end}`} className="btn btn--quiet">A visit</Link>
            </div>
            <button type="button" className="linkish" style={{ alignSelf: "flex-start" }} onClick={() => { setStart(null); setEnd(null); }}>
              Clear
            </button>
          </>
        ) : start ? (
          <p style={{ fontSize: 15, lineHeight: 1.5 }}>
            Starting <strong style={{ fontWeight: 600 }}>{fmtDay(start)}</strong>. Now tap the last day.
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>Tap a first day, then a last day, to check a trip.</p>
        )}
      </section>
    </>
  );
}
