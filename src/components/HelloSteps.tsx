"use client";

import { useEffect, useState } from "react";
import { finishOnboarding } from "@/app/actions";
import { ShareIcon } from "./Icons";
import { isStandalone, NotificationsToggle } from "./Notifications";
import { Sunflower } from "./Sunflower";

type Props = {
  name: string;
  them: string;
  /** True when the maker set this up for this person, so the words can come from them. */
  invited: boolean;
  publicKey: string | null;
  demo: boolean;
};

export function HelloSteps({ name, them, invited, publicKey, demo }: Props) {
  const [standalone, setStandalone] = useState<boolean | null>(null);
  useEffect(() => setStandalone(isStandalone()), []);

  return (
    <main className="screen screen--plain" style={{ gap: 32, paddingTop: "calc(var(--safe-top) + 56px)" }}>
      <div className="stack rise" style={{ gap: 18 }}>
        <Sunflower bloom={0.55} size={60} />
        <h1 className="title">{invited ? `You’re in, ${name}.` : `Hi ${name}.`}</h1>
      </div>

      <section className="stack rise rise-2" style={{ gap: 8 }}>
        <h2 className="h2">Keep it on your Home Screen</h2>
        {standalone ? (
          <p className="muted">Done.</p>
        ) : (
          <p className="muted" style={{ lineHeight: 1.55 }}>
            In Safari, tap <ShareIcon size={15} /> then <span style={{ color: "var(--ink)" }}>Add to Home Screen</span>, and open Soon from there.
          </p>
        )}
      </section>

      <section className="stack rise rise-3" style={{ gap: 12 }}>
        <h2 className="h2">{invited ? "So you know when I’m on my way" : `So you hear from ${them}`}</h2>
        <NotificationsToggle publicKey={publicKey} demo={demo} />
      </section>

      <form action={finishOnboarding} style={{ marginTop: "auto" }}>
        <button type="submit" className={`btn btn--block${standalone ? "" : " btn--quiet"}`}>
          {standalone ? "Done" : "Later"}
        </button>
      </form>
    </main>
  );
}
