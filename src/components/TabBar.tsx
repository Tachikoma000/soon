"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, RouteIcon, SunIcon } from "./Icons";

export function TabBar({ badge = 0 }: { badge?: number }) {
  const path = usePathname();
  const current = path.startsWith("/calendar") ? "calendar" : path.startsWith("/plans") ? "plans" : "home";
  const tabs = [
    { id: "home", href: "/", label: "Soon", icon: <SunIcon /> },
    { id: "calendar", href: "/calendar", label: "Calendar", icon: <CalendarIcon /> },
    { id: "plans", href: "/plans", label: "Plans", icon: <RouteIcon /> },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar__inner">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} className="tab" aria-current={current === t.id ? "page" : undefined}>
            {t.icon}
            {t.label}
            {t.id === "plans" && badge > 0 && (
              <span className="tab__badge" aria-label={`${badge} waiting for you`}>
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
