"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MonthCell } from "@/lib/data";
import { DOW_LONG, DOW_SHORT, addDays, dow, fmtDay, fmtMonthDay, fmtRange } from "@/lib/dates";
import { Mark } from "./Dots";
import { CloseIcon } from "./Icons";
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
  const clear = () => {
    setStart(null);
    setEnd(null);
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
        const s = byDay.get(d)?.[who];
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
            ? `Already together ${when}`
            : r.who === "me"
              ? r.state === "b" ? `You’re busy ${when}` : `You said maybe ${when}`
              : r.state === "b" ? `${themName}’s busy ${when}` : `${themName} said maybe ${when}`;
        return { ...r, text };
      });
  }, [start, end, byDay, themName]);

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
            const cls = [
              "cell",
              weekend && "cell--wk",
              inRange && "cell--band",
              inRange && (c.day === start || w === 0) && "cell--l",
              inRange && (c.day === last || w === 6) && "cell--r",
              isEnd && "cell--end",
              !isEnd && !c.planned && weekend && c.me === "f" && c.them === "f" && !past && "cell--open",
              !isEnd && c.planned && "cell--planned",
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
                  <span className="cell__marks" aria-hidden="true">
                    {!c.planned && <Mark who="me" state={c.me} />}
                    {!c.planned && <Mark who="them" state={c.them} />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <section aria-live="polite" className="stack-lg" style={{ paddingTop: 18, borderTop: "1px solid var(--line)", minHeight: 120 }}>
        {start && end ? (
          <>
            <div className="row-between" style={{ alignItems: "center" }}>
              <h2 className="title" style={{ fontSize: 30 }}>{start === end ? fmtDay(start) : fmtRange(start, end)}</h2>
              <button type="button" className="icon-btn" aria-label="Clear" onClick={clear} style={{ marginRight: -10 }}>
                <CloseIcon size={20} />
              </button>
            </div>
            {conflicts.length === 0 ? (
              <p className="status"><SunMark size={18} /> You’re both free.</p>
            ) : (
              <ul className="stack" style={{ gap: 8 }}>
                {conflicts.map((k, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "var(--ink-2)" }}>
                    <Mark who={k.who} state={k.state} large />
                    {k.text}
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/propose?kind=${end > addDays(start, 3) ? "trip" : "visit-them"}&start=${start}&end=${end}`} className="btn btn--block">
              Ask {themName}
            </Link>
          </>
        ) : start ? (
          <p style={{ fontSize: 16 }}>
            {fmtDay(start)} to…
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 15.5 }}>Tap two days to plan something.</p>
        )}
      </section>
    </>
  );
}
