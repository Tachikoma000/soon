import Link from "next/link";
import { enterDemo, saveSettings } from "../actions";
import { InviteLink } from "@/components/client";
import { ChevronLeft } from "@/components/Icons";
import { NotificationsToggle } from "@/components/Notifications";
import { DRIVE_MINUTES, isDemo, people } from "@/lib/config";
import { fmtDuration } from "@/lib/dates";
import { listCalendars, NotConnectedError, type CalendarInfo } from "@/lib/google";
import { requireViewer } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { me, them } = await requireViewer();
  const { saved } = await searchParams;
  const store = await getStore();
  const s = await store.settings(me.id);
  const demo = isDemo();
  const [myEmail, theirEmail] = await Promise.all([store.email(me.id), store.email(them.id)]);

  let calendars: CalendarInfo[] | null = null;
  let calError: string | null = null;
  if (!demo && s.connected) {
    try {
      calendars = await listCalendars(me.id);
    } catch (e) {
      calError = e instanceof NotConnectedError ? "Reconnect Google to choose calendars." : "Couldn’t load your calendars just now.";
    }
  }
  const counted = new Set(s.calendars);

  return (
    <main className="screen screen--plain" style={{ gap: 28 }}>
      <Link href="/" className="back">
        <ChevronLeft /> Soon
      </Link>
      <h1 className="title">Settings</h1>
      {saved && <div className="notice"><span><strong>Saved.</strong></span></div>}

      <form action={saveSettings} className="stack-lg" style={{ gap: 28 }}>
        <section className="stack-lg">
          <div className="stack" style={{ gap: 4 }}>
            <h2 className="eyebrow">On your calendar</h2>
            <p className="small muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
              How plans appear on your Google Calendar. You can still change it plan by plan.
            </p>
          </div>
          <label className="field">
            <span className="small muted">Default title</span>
            <input className="input" name="eventTitle" defaultValue={s.eventTitle ?? ""} placeholder={`e.g. Personal, or “${them.name} visiting”`} maxLength={80} />
          </label>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <label className="switch-row">
              <span className="switch-row__text">
                <span className="switch-row__label">Private events</span>
                <span className="switch-row__hint">Others who see your calendar see “busy”, not the title.</span>
              </span>
              <span className="switch">
                <input type="checkbox" name="private" defaultChecked={s.eventPrivate} />
                <span />
              </span>
            </label>
            <label className="switch-row">
              <span className="switch-row__text">
                <span className="switch-row__label">Include the drive</span>
                <span className="switch-row__hint">When you’re the one travelling, block {fmtDuration(DRIVE_MINUTES)} each way.</span>
              </span>
              <span className="switch">
                <input type="checkbox" name="drive" defaultChecked={s.includeDrive} />
                <span />
              </span>
            </label>
          </div>
        </section>

        <section className="stack-lg">
          <div className="stack" style={{ gap: 4 }}>
            <h2 className="eyebrow">Calendars that count</h2>
            <p className="small muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
              Soon only ever sees when you’re busy on these, never what. Leave out ones like holidays or shared team calendars.
            </p>
          </div>
          {demo ? (
            <p className="small muted">In the demo, your main calendar counts.</p>
          ) : calError ? (
            <p className="small muted">{calError} <a href="/api/auth/google">Reconnect</a></p>
          ) : calendars ? (
            <div style={{ borderTop: "1px solid var(--line)" }}>
              <input type="hidden" name="calendarsShown" value="1" />
              {calendars.map((c) => (
                <label key={c.id} className="switch-row" style={{ minHeight: 56 }}>
                  <span className="switch-row__text">
                    <span className="switch-row__label">{c.name}</span>
                    {c.primary && <span className="switch-row__hint">Your main calendar</span>}
                  </span>
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
            <p className="small muted">Connect Google to choose. <a href="/api/auth/google">Connect</a></p>
          )}
        </section>

        <button type="submit" className="btn btn--block">Save</button>
      </form>

      {!demo && (
        <section className="stack-lg" id="invite">
          <h2 className="eyebrow">{them.name}</h2>
          <InviteLink themName={them.name} joinedAs={theirEmail} />
        </section>
      )}

      <section className="stack-lg">
        <h2 className="eyebrow">Notifications</h2>
        <p className="small muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
          A note when {them.name} proposes a plan, answers yours, or is on the way.
        </p>
        <NotificationsToggle publicKey={process.env.VAPID_PUBLIC_KEY ?? null} demo={demo} />
      </section>

      <section className="stack">
        <h2 className="eyebrow">Account</h2>
        {demo ? (
          <>
            <p className="small muted">This is the demo, with sample data. View it as:</p>
            <div className="btn-row">
              {people().map((p) => (
                <form key={p.id} action={enterDemo.bind(null, p.id)} style={{ display: "flex" }}>
                  <button type="submit" className={`btn ${p.id === me.id ? "" : "btn--quiet"}`} style={{ flex: 1 }}>{p.name}</button>
                </form>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="small muted">Signed in as {myEmail}</p>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="linkish">Sign out</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
