"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptPlan, createInvite, declinePlan, setSignal } from "@/app/actions";
import type { SignalValue } from "@/lib/types";

/** Free / Maybe / Can't for one day. Nothing pressed = go by the calendar. */
export function SignalControl({ day, value, label }: { day: string; value: SignalValue | null; label: string }) {
  const [v, setV] = useState<SignalValue | null>(value);
  const [, start] = useTransition();
  const opts: Array<[SignalValue, string]> = [
    ["free", "Free"],
    ["maybe", "Maybe"],
    ["no", "Can’t"],
  ];
  return (
    <div role="group" aria-label={label} className="seg seg--sm">
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
  );
}

export function AnswerProposal({ planId, acceptLabel }: { planId: string; acceptLabel: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="stack">
      <button type="button" className="btn btn--block" disabled={pending} onClick={() => start(() => acceptPlan(planId, null))}>
        {pending ? "One sec…" : acceptLabel}
      </button>
      <button type="button" className="btn btn--block btn--quiet" disabled={pending} onClick={() => start(() => declinePlan(planId))}>
        Not that weekend
      </button>
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
      {pending ? "One sec…" : children}
    </button>
  );
}

export function ActionButton({
  action,
  children,
  className = "btn",
  pendingText = "One sec…",
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

/** A one-time link for the other person. */
export function InviteLink({ themName, joinedAs }: { themName: string; joinedAs: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => setCanShare("share" in navigator), []);

  const make = () =>
    start(async () => {
      setCopied(false);
      setLink(await createInvite());
    });

  if (link) {
    return (
      <div className="stack">
        <input className="input" readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 14 }} />
        <div className="btn-row">
          {canShare && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ url: link }).catch(() => {});
              }}
            >
              Send
            </button>
          )}
          <button
            type="button"
            className={`btn${canShare ? " btn--quiet" : ""}`}
            onClick={() => {
              navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => {});
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="small faint">Works once.</p>
      </div>
    );
  }

  if (joinedAs) {
    return (
      <div className="stack" style={{ gap: 2 }}>
        <p className="small muted">{joinedAs}</p>
        <button type="button" className="linkish" onClick={make} disabled={pending}>
          {pending ? "One sec…" : "New invite link"}
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="btn btn--block" onClick={make} disabled={pending}>
      {pending ? "One sec…" : `Invite ${themName}`}
    </button>
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
