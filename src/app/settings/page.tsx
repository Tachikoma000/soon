import Link from "next/link";
import { enterDemo, saveSettings } from "@/app/actions";
import { InviteLink, ShareToggle } from "@/components/client";
import { ChevronLeft } from "@/components/Icons";
import { NotificationsToggle } from "@/components/Notifications";
import { isDemo, people } from "@/lib/config";
import { listCalendars, NotConnectedError, type CalendarInfo } from "@/lib/google";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const SHARE_NOTES: Record<string, string> = {
  declined: "Google didn’t share the event names. Try again and tick the box.",
  account: "That was a different Google account. Try again with yours.",
  cancelled: "Left as it was.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; share?: string }> }) {
  const { me, them } = await requireViewer();
  const { saved, share } = await searchParams;
  const store = await getStore();
  const s = await store.settings(me.id);
  const demo = isDemo();
  const [myEmail, theirEmail] = await Promise.all([store.email(me.id), store.email(them.id)]);

  let calendars: CalendarInfo[] | null = null;
  let calError = false;
  if (!demo && s.connected) {
    try {
      calendars = await listCalendars(me.id);
    } catch (e) {
      calError = true;
      if (!(e instanceof NotConnectedError)) console.error(e);
    }
  }
  const counted = new Set(s.calendars);

  return (
    <main className="screen screen--plain" style={{ gap: 36 }}>
      <Link href="/" className="back">
        <ChevronLeft /> Soon
      </Link>

      <form action={saveSettings} className="stack-lg" style={{ gap: 36 }}>
        <section className="stack" style={{ gap: 14 }}>
          <h2 className="h2">On my calendar</h2>
          <label className="field">
            <span className="label">Plans show up as</span>
            <input className="input" name="eventTitle" defaultValue={s.eventTitle ?? ""} placeholder={`Where, or “${them.name} visiting”`} maxLength={80} />
          </label>
          <div>
            <label className="switch-row">
              <span>Hide the details from others</span>
              <span className="switch">
                <input type="checkbox" name="private" defaultChecked={s.eventPrivate} />
                <span />
              </span>
            </label>
            <label className="switch-row">
              <span>Block the drive too</span>
              <span className="switch">
                <input type="checkbox" name="drive" defaultChecked={s.includeDrive} />
                <span />
              </span>
            </label>
          </div>
        </section>

        {!demo && (
          <section className="stack" style={{ gap: 14 }}>
            <h2 className="h2">Calendars that count</h2>
            {calError ? (
              <a href="/api/auth/google" className="linkish">Reconnect Google</a>
            ) : calendars ? (
              <div>
                <input type="hidden" name="calendarsShown" value="1" />
                {calendars.map((c) => (
                  <label key={c.id} className="switch-row">
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{c.primary ? "Main calendar" : c.name}</span>
                    <span className="switch">
                      <input
                        type="checkbox"
                        name="calendars"
                        value={c.primary ? "primary" : c.id}
                        defaultChecked={c.primary ? counted.has("primary") || counted.has(c.id) : counted.has(c.id)}
                      />
                      <span />
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <a href="/api/auth/google" className="linkish">Connect Google</a>
            )}
          </section>
        )}

        <div className="row-between" style={{ alignItems: "center", gap: 16 }}>
          <button type="submit" className="btn" style={{ flex: 1 }}>Save</button>
          {saved && <span className="small muted" role="status">Saved</span>}
        </div>
      </form>

      <section className="stack" id="share" style={{ gap: 14 }}>
        <h2 className="h2">{them.name}</h2>
        <ShareToggle themName={them.name} on={s.shareDetails} note={share ? SHARE_NOTES[share] ?? "Try once more." : null} />
        {!demo && (
          <div id="invite" style={{ marginTop: 10 }}>
            <InviteLink themName={them.name} joinedAs={theirEmail} />
          </div>
        )}
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h2 className="h2">Notifications</h2>
        <NotificationsToggle publicKey={process.env.VAPID_PUBLIC_KEY ?? null} demo={demo} />
      </section>

      <section className="stack" style={{ gap: 2, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
        {demo ? (
          <>
            <p className="small muted" style={{ paddingTop: 14 }}>Look around as</p>
            <div className="btn-row" style={{ marginTop: 10 }}>
              {people().map((p) => (
                <form key={p.id} action={enterDemo.bind(null, p.id)} style={{ display: "flex" }}>
                  <button type="submit" className={`btn ${p.id === me.id ? "" : "btn--quiet"}`} style={{ flex: 1 }}>{p.name}</button>
                </form>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="small faint" style={{ paddingTop: 14 }}>{myEmail}</p>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="linkish">Sign out</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
