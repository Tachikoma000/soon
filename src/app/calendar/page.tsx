import Link from "next/link";
import { MonthPicker } from "@/components/MonthPicker";
import { ChevronLeft, ChevronRight } from "@/components/Icons";
import { TabBar } from "@/components/TabBar";
import { TZ } from "@/lib/config";
import { loadMonth } from "@/lib/data";
import { monthTitle, today } from "@/lib/dates";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function shift(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { me, them } = await requireViewer();
  const { m } = await searchParams;
  const thisMonth = today(TZ).slice(0, 7);
  const max = shift(thisMonth, 12);
  const ym = m && /^\d{4}-\d{2}$/.test(m) && m >= thisMonth && m <= max ? m : thisMonth;
  const month = await loadMonth({ me, them }, ym);
  const t = monthTitle(ym);
  const store = await getStore();
  const incoming = (await store.plans()).filter((p) => p.status === "proposed" && p.proposedBy === them.id && p.endDay >= month.todayStr).length;

  return (
    <>
      <main className="screen">
        <header className="stack">
          <div className="row-between" style={{ alignItems: "center" }}>
            <h1 className="title" style={{ fontSize: 36 }}>
              {t.month} <span className="faint">{t.year}</span>
            </h1>
            <div style={{ display: "flex", marginRight: -10 }}>
              {ym > thisMonth ? (
                <Link className="icon-btn" href={`/calendar?m=${shift(ym, -1)}`} aria-label="Previous month"><ChevronLeft /></Link>
              ) : (
                <span className="icon-btn" aria-hidden="true" style={{ opacity: 0.3 }}><ChevronLeft /></span>
              )}
              {ym < max ? (
                <Link className="icon-btn" href={`/calendar?m=${shift(ym, 1)}`} aria-label="Next month"><ChevronRight size={22} /></Link>
              ) : (
                <span className="icon-btn" aria-hidden="true" style={{ opacity: 0.3 }}><ChevronRight size={22} /></span>
              )}
            </div>
          </div>
          <div className="row-between small muted" style={{ alignItems: "center" }}>
            <span>Tap a first and last day</span>
            <span className="legend">
              <span><span className="swatch swatch--me" />You</span>
              <span><span className="swatch swatch--them" />{them.name}</span>
            </span>
          </div>
        </header>
        <MonthPicker key={ym} cells={month.cells} lead={month.lead} todayStr={month.todayStr} themName={them.name} />
      </main>
      <TabBar current="calendar" badge={incoming} />
    </>
  );
}
