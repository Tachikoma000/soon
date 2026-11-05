import Link from "next/link";
import { CalendarIcon, RouteIcon, SunIcon } from "./Icons";

type Tab = "home" | "calendar" | "plans";

export function TabBar({ current, badge = 0 }: { current: Tab; badge?: number }) {
  const tabs: Array<{ id: Tab; href: string; label: string; icon: React.ReactNode }> = [
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
              <span className="tab__badge" aria-label={`${badge} waiting`}>
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
