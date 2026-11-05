"use client";

import { useEffect } from "react";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Registers the service worker and keeps the app-icon badge honest. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    const nav = navigator as BadgeNavigator;
    const sync = () => {
      if (document.visibilityState !== "visible" || !nav.setAppBadge) return;
      fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "badge" }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count?: number } | null) => {
          if (!d) return;
          if (d.count) nav.setAppBadge?.(d.count).catch(() => {});
          else nav.clearAppBadge?.().catch(() => {});
        })
        .catch(() => {});
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return null;
}
