"use client";

import { useEffect, useState } from "react";
import { finishOnboarding } from "@/app/actions";
import { ShareIcon } from "./Icons";
import { isStandalone, NotificationsToggle } from "./Notifications";
import { Sunflower } from "./Sunflower";

export function HelloSteps({ name, them, publicKey, demo }: { name: string; them: string; publicKey: string | null; demo: boolean }) {
  const [standalone, setStandalone] = useState<boolean | null>(null);
  useEffect(() => setStandalone(isStandalone()), []);

  return (
    <main className="screen screen--plain" style={{ gap: 28, paddingTop: "calc(var(--safe-top) + 48px)" }}>
      <div className="stack rise" style={{ alignItems: "flex-start", gap: 14 }}>
        <Sunflower bloom={0.55} size={64} />
        <h1 className="title">Hi {name}.</h1>
        <p className="lede">Two small things and you’re set.</p>
      </div>

      <section className="stack-lg rise rise-2" style={{ paddingTop: 18, borderTop: "1px solid var(--line)" }}>
        <div className="row-between">
          <h2 className="serif" style={{ fontSize: 22 }}>1 · Put Soon on your Home Screen</h2>
        </div>
        {standalone ? (
          <p className="small muted">Done. You opened Soon from your Home Screen.</p>
        ) : (
          <ol className="stack" style={{ paddingLeft: 18, margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
            <li>In Safari, tap <ShareIcon size={15} /> <strong style={{ color: "var(--ink)" }}>Share</strong>.</li>
            <li>Choose <strong style={{ color: "var(--ink)" }}>Add to Home Screen</strong>.</li>
            <li>Open Soon from your Home Screen to finish here.</li>
          </ol>
        )}
      </section>

      <section className="stack-lg rise rise-3" style={{ paddingTop: 18, borderTop: "1px solid var(--line)" }}>
        <h2 className="serif" style={{ fontSize: 22 }}>2 · Hear from {them}</h2>
        <p className="small muted" style={{ fontSize: 14.5, lineHeight: 1.5 }}>
          A note when {them} proposes a plan, says yes, or is on the way.
        </p>
        <NotificationsToggle publicKey={publicKey} demo={demo} />
      </section>

      <form action={finishOnboarding} style={{ marginTop: "auto" }}>
        <button type="submit" className="btn btn--block">
          {standalone ? "Let’s go" : "Skip for now"}
        </button>
      </form>
    </main>
  );
}
