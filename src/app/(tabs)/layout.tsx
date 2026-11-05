import { TabBar } from "@/components/TabBar";
import { TZ } from "@/lib/config";
import { today } from "@/lib/dates";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

/** Home, Calendar and Plans share the tab bar, so it stays put while you move between them. */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const { them } = await requireViewer();
  const store = await getStore();
  const todayStr = today(TZ);
  const waiting = (await store.plans()).filter((p) => p.status === "proposed" && p.proposedBy === them.id && p.endDay >= todayStr).length;
  return (
    <>
      {children}
      <TabBar badge={waiting} />
    </>
  );
}
