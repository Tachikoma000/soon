"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptPlan, createInvite, declinePlan, setSignal } from "@/app/actions";
import type { SignalValue } from "@/lib/types";

/** Free / Maybe / Can't for one day. Nothing pressed = go by my calendar. */
export function SignalControl({ day, value, label }: { day: string; value: SignalValue | null; label: string }) {
  const [v, setV] = useState<SignalValue | null>(value);
  const [, start] = useTransition();
  const opts: Array<[SignalValue, string]> = [
    ["free", "Free"],
    ["maybe", "Maybe"],
    ["no", "Can’t"],
  ];
  return (
    <div className="row-between" style={{ alignItems: "center" }}>
      <span className="small muted">{v ? "Your answer" : "From your calendar"}</span>
      <div role="group" aria-label={label} className="seg">
        {opts.map(([val, text]) => (
          <button
            key={val}
            type="button"
            aria-pressed={v === val}
            onClick={() => {
              const next = v === val ? null : val;
              setV(next);
              start(() => setSignal(day, next));
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Answer a proposal: pick how it shows on your calendar, then yes or other dates. */
export function AnswerProposal({
  planId,
  titles,
  acceptLabel,
}: {
  planId: string;
  titles: string[];
  acceptLabel: string;
}) {
  const [title, setTitle] = useState(titles[0]);
  const [pending, start] = useTransition();
  return (
    <div className="stack-lg">
      <div className="stack">
        <p className="eyebrow">On your calendar as</p>
        <div className="chips" role="group" aria-label="Event title on your calendar">
          {titles.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={title === t} onClick={() => setTitle(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="stack">
        <button type="button" className="btn btn--block" disabled={pending} onClick={() => start(() => acceptPlan(planId, title))}>
          {pending ? "Adding to your calendars…" : acceptLabel}
        </button>
        <button type="button" className="btn btn--block btn--quiet" disabled={pending} onClick={() => start(() => declinePlan(planId))}>
          Suggest other dates
        </button>
      </div>
    </div>
  );
}

export function ConfirmButton({
  action,
  message,
  children,
  className = "linkish",
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (window.confirm(message)) start(() => action());
      }}
    >
      {pending ? "One moment…" : children}
    </button>
  );
}

export function ActionButton({
  action,
  children,
  className = "btn",
  pendingText = "One moment…",
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending} onClick={() => start(() => action())}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Makes a one-time invite link for the other person and offers to copy or share it. */
export function InviteLink({ themName, joinedAs }: { themName: string; joinedAs: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const make = () =>
    start(async () => {
      setCopied(false);
      setLink(await createInvite());
    });

  return (
    <div className="stack-lg">
      <p className="small muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        {joinedAs
          ? `${themName} signs in as ${joinedAs}. If that’s the wrong account, make a new link: the next account used with it replaces this one.`
          : `${themName} hasn’t joined yet. Make a link and send it, or open it on ${themName}’s phone. Whichever Google account is used with it becomes ${themName}’s, and the link stops working after that.`}
      </p>
      {link ? (
        <div className="stack">
          <input className="input" readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 14 }} />
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => {});
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            {canShare && (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title: "Soon", url: link }).catch(() => {});
                }}
              >
                Share
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" className={`btn btn--block${joinedAs ? " btn--quiet" : ""}`} onClick={make} disabled={pending}>
          {pending ? "Making a link…" : joinedAs ? "Make a new sign-in link" : `Make ${themName}’s invite link`}
        </button>
      )}
    </div>
  );
}

/** Re-renders the page every minute (used while someone's on the road). */
export function AutoRefresh({ every = 60_000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
