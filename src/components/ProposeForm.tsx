"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { proposePlan } from "@/app/actions";
import { fmtDuration, fmtTime, hhmmToMinutes, DOW_SHORT, dow } from "@/lib/dates";
import { ArrowRight, CloseIcon, LockIcon } from "./Icons";

type Kind = "visit-them" | "visit-me" | "trip";
type Who = { name: string; home: string };

type Props = {
  initialKind: Kind;
  start: string;
  end: string;
  minDay: string;
  me: Who;
  them: Who;
  savedTitle: string | null;
  eventPrivate: boolean;
  includeDrive: boolean;
  driveMinutes: number;
  error: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--block" disabled={pending}>
      {pending ? "Sending…" : label} {!pending && <ArrowRight />}
    </button>
  );
}

export function ProposeForm(p: Props) {
  const [kind, setKind] = useState<Kind>(p.initialKind);
  const [start, setStart] = useState(p.start);
  const [end, setEnd] = useState(p.end);
  const [arrive, setArrive] = useState("17:30");
  const [isPrivate, setPrivate] = useState(p.eventPrivate);
  const [drive, setDrive] = useState(p.includeDrive);
  const [tripName, setTripName] = useState("");

  const travelling = kind === "visit-them";
  const smart = kind === "trip" ? tripName.trim() || "Trip" : kind === "visit-them" ? p.them.home : `${p.them.name} visiting`;
  const titles = useMemo(
    () => [...new Set([p.savedTitle, smart, "Personal", "Busy", "Out of office"].filter((x): x is string => !!x))].slice(0, 4),
    [p.savedTitle, smart],
  );
  const [title, setTitle] = useState<string>(titles[0]);
  const chosen = titles.includes(title) ? title : titles[0];

  const day = (d: string) => (d ? DOW_SHORT[dow(d)] : "");
  const a = hhmmToMinutes(arrive, 1050);
  const offset = travelling && drive ? p.driveMinutes : 0;
  const when =
    kind === "trip"
      ? `${day(start)} – ${day(end)}, all day`
      : `${day(start)} ${fmtTime(a - offset)} – ${day(end)} ${fmtTime(16 * 60 + offset)}`;

  const kinds: Array<[Kind, string]> = [
    ["visit-them", "I visit"],
    ["visit-me", `${p.them.name} visits`],
    ["trip", "A trip"],
  ];
  const line =
    kind === "visit-them"
      ? `You go to ${p.them.home}.`
      : kind === "visit-me"
        ? `${p.them.name} comes to ${p.me.home}.`
        : "Somewhere new, together.";

  return (
    <form action={proposePlan}>
      <main className="screen screen--footer" style={{ gap: 26 }}>
        <header className="row-between" style={{ alignItems: "center" }}>
          <h1 className="title" style={{ fontSize: 31 }}>{kind === "trip" ? "Propose a trip" : "Propose a visit"}</h1>
          <Link href="/" className="icon-btn" aria-label="Close" style={{ marginRight: -10 }}>
            <CloseIcon />
          </Link>
        </header>

        {p.error && <div className="notice">{p.error}</div>}

        <section className="stack">
          <input type="hidden" name="kind" value={kind} />
          <div role="group" aria-label="What kind of plan" className="seg seg--full">
            {kinds.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ fontSize: 14 }}>{line}</p>
        </section>

        {kind === "trip" && (
          <label className="field">
            <span className="eyebrow">Call it</span>
            <input className="input" name="title" value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="Winter trip" maxLength={60} />
          </label>
        )}

        <section aria-label="When" className="when">
          <div>
            <label className="eyebrow" htmlFor="start">{kind === "trip" ? "Leave" : "Arrive"}</label>
            <input id="start" type="date" name="start" value={start} min={p.minDay} required onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
            {kind !== "trip" && (
              <input type="time" name="arrive" aria-label="Arrival time" value={arrive} onChange={(e) => setArrive(e.target.value)} step={900} />
            )}
          </div>
          <div>
            <label className="eyebrow" htmlFor="end">Home again</label>
            <input id="end" type="date" name="end" value={end} min={start} required onChange={(e) => setEnd(e.target.value)} />
            {kind !== "trip" && <span className="small muted" style={{ minHeight: 24, display: "flex", alignItems: "center" }}>afternoon</span>}
          </div>
        </section>

        <label className="field">
          <span className="eyebrow">A note for {p.them.name}</span>
          <textarea className="textarea" name="note" rows={2} maxLength={280} placeholder="Farmers market on Saturday?" />
        </label>

        <section className="stack-lg" aria-labelledby="oncal">
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="oncal" className="eyebrow">On your calendar</h2>
            <p className="small muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
              Choose how this shows up for anyone who can see your calendar. {p.them.name} chooses separately.
            </p>
          </div>
          <input type="hidden" name="eventTitle" value={chosen} />
          <div className="chips" role="group" aria-label="Event title">
            {titles.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={chosen === t} onClick={() => setTitle(t)}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <label className="switch-row">
              <span className="switch-row__text">
                <span className="switch-row__label">Private event</span>
                <span className="switch-row__hint">Others see the time is taken, not the details.</span>
              </span>
              <span className="switch">
                <input type="checkbox" name="private" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
                <span />
              </span>
            </label>
            {travelling && (
              <label className="switch-row">
                <input type="hidden" name="driveShown" value="1" />
                <span className="switch-row__text">
                  <span className="switch-row__label">Include the drive</span>
                  <span className="switch-row__hint">Blocks {fmtDuration(p.driveMinutes)} each way.</span>
                </span>
                <span className="switch">
                  <input type="checkbox" name="drive" checked={drive} onChange={(e) => setDrive(e.target.checked)} />
                  <span />
                </span>
              </label>
            )}
          </div>
          <div className="preview" aria-label="Preview">
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted" style={{ fontSize: 12.5 }}>You see</span>
              <div className="preview__ev preview__ev--mine">
                <span className="preview__title">
                  {chosen}
                  {isPrivate && <LockIcon />}
                </span>
                <span style={{ fontSize: 12.5 }}>{when}</span>
              </div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted" style={{ fontSize: 12.5 }}>Others see</span>
              <div className="preview__ev preview__ev--theirs">
                <span className="preview__title">{isPrivate ? "busy" : chosen}</span>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{when}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer-bar">
        <Submit label={`Send to ${p.them.name}`} />
      </footer>
    </form>
  );
}
