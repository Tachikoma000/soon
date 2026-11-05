"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Registers the service worker, keeps the icon badge honest, and refreshes when the app comes back into view. */
export function ServiceWorker() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    const nav = navigator as BadgeNavigator;
    const badge = () => {
      if (!nav.setAppBadge) return;
      fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "badge" }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count?: number } | null) => {
          if (!d) return;
          if (d.count) nav.setAppBadge?.(d.count).catch(() => {});
          else nav.clearAppBadge?.().catch(() => {});
        })
        .catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      badge();
      // Back after a while: show what changed while the app was in the background.
      if (hiddenAt.current && Date.now() - hiddenAt.current > 30_000) router.refresh();
      hiddenAt.current = null;
    };

    badge();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);
  return null;
}
