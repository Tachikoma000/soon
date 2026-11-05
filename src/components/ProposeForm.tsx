"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { proposePlan } from "@/app/actions";
import { ChevronRight, CloseIcon } from "./Icons";

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
  error: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--block" disabled={pending}>
      {pending ? "Sending…" : label}
    </button>
  );
}

export function ProposeForm(p: Props) {
  const [kind, setKind] = useState<Kind>(p.initialKind);
  const [start, setStart] = useState(p.start);
  const [end, setEnd] = useState(p.end);
  const [isPrivate, setPrivate] = useState(p.eventPrivate);
  const [drive, setDrive] = useState(p.includeDrive);
  const [tripName, setTripName] = useState("");
  const [title, setTitle] = useState<string | null>(null);

  const travelling = kind === "visit-them";
  const smart = kind === "trip" ? tripName.trim() || "Trip" : kind === "visit-them" ? p.them.home : `${p.them.name} visiting`;
  const shown = title ?? p.savedTitle ?? smart;

  const kinds: Array<[Kind, string]> = [
    ["visit-them", "I visit"],
    ["visit-me", `${p.them.name} visits`],
    ["trip", "A trip"],
  ];

  return (
    <form action={proposePlan}>
      <main className="screen screen--footer" style={{ gap: 24 }}>
        <header className="row-between" style={{ alignItems: "center" }}>
          <h1 className="title" style={{ fontSize: 32 }}>Ask {p.them.name}</h1>
          <Link href="/" className="icon-btn" aria-label="Close" style={{ marginRight: -10 }}>
            <CloseIcon />
          </Link>
        </header>

        {p.error && <p className="small" style={{ color: "var(--terra-ink)" }}>{p.error}</p>}

        <input type="hidden" name="kind" value={kind} />
        <div role="group" aria-label="What kind of plan" className="seg seg--full">
          {kinds.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>

        {kind === "trip" && (
          <input
            className="input input--big"
            name="title"
            aria-label="Where to"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder="Where to?"
            maxLength={60}
            autoComplete="off"
          />
        )}

        <section aria-label="When" className="when">
          <div>
            <label className="label" htmlFor="start">From</label>
            <input
              id="start"
              type="date"
              name="start"
              value={start}
              min={p.minDay}
              required
              onChange={(e) => {
                setStart(e.target.value);
                if (e.target.value > end) setEnd(e.target.value);
              }}
            />
            {kind !== "trip" && <input type="time" name="arrive" aria-label="Arriving around" defaultValue="17:30" step={900} />}
          </div>
          <div>
            <label className="label" htmlFor="end">To</label>
            <input id="end" type="date" name="end" value={end} min={start} required onChange={(e) => setEnd(e.target.value)} />
          </div>
        </section>

        <textarea className="textarea" name="note" rows={2} maxLength={280} placeholder={`Add a note for ${p.them.name}`} aria-label={`A note for ${p.them.name}`} />

        <details className="more">
          <summary>
            <span className="muted">
              On my calendar as <span style={{ color: "var(--ink)" }}>{shown || "…"}</span>
              {isPrivate ? ", private" : ""}
            </span>
            <ChevronRight size={16} />
          </summary>
          <div className="more__body">
            <input
              className="input"
              name="eventTitle"
              aria-label="Title on my calendar"
              value={shown}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              style={{ marginBottom: 6 }}
            />
            <label className="switch-row">
              <span>Hide the details from others</span>
              <span className="switch">
                <input type="checkbox" name="private" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
                <span />
              </span>
            </label>
            {travelling && (
              <label className="switch-row">
                <input type="hidden" name="driveShown" value="1" />
                <span>Block the drive too</span>
                <span className="switch">
                  <input type="checkbox" name="drive" checked={drive} onChange={(e) => setDrive(e.target.checked)} />
                  <span />
                </span>
              </label>
            )}
          </div>
        </details>
      </main>
      <footer className="footer-bar">
        <Submit label={`Send to ${p.them.name}`} />
      </footer>
    </form>
  );
}
