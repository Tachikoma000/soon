"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "./Icons";

type State = "checking" | "unsupported" | "install-first" | "blocked" | "off" | "on" | "working";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIOS(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function NotificationsToggle({ publicKey, demo }: { publicKey: string | null; demo: boolean }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIOS() && !isStandalone() ? "install-first" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    if (!publicKey) return;
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }),
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  };

  const turnOff = async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", subscription: { endpoint: sub.endpoint } }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  };

  if (demo || !publicKey) return <p className="small muted">Not in the demo.</p>;
  if (state === "checking") return <div style={{ minHeight: 54 }} />;
  if (state === "install-first") return <p className="small muted">Works once Soon is on your Home Screen.</p>;
  if (state === "unsupported") return <p className="small muted">This browser can’t do notifications.</p>;
  if (state === "blocked") return <p className="small muted">They’re off for Soon in your iPhone’s Settings.</p>;
  if (state === "on") {
    return (
      <div className="row-between" style={{ alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <BellIcon /> On
        </span>
        <button type="button" className="linkish" onClick={turnOff}>Turn off</button>
      </div>
    );
  }
  return (
    <button type="button" className="btn btn--block" onClick={turnOn} disabled={state !== "off"}>
      <BellIcon /> {state === "working" ? "One sec…" : "Turn on notifications"}
    </button>
  );
}
