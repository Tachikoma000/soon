import Link from "next/link";
import { appUrl, people } from "@/lib/config";

export const metadata = { title: "Privacy · Soon" };

export default function Privacy() {
  const [maker] = people();
  return (
    <main className="screen screen--plain" style={{ gap: 18, lineHeight: 1.55, fontSize: 15.5 }}>
      <Link href="/" className="back" style={{ marginBottom: 0 }}>Soon</Link>
      <h1 className="title">Privacy</h1>
      <p className="muted">Soon is a private calendar shared by two people. It isn’t a public service, and nobody else can sign in.</p>

      <h2 className="h2">What Soon reads from Google</h2>
      <p>When your free time is shown, Soon asks Google only <em>when</em> you’re busy on the calendars you choose. It never reads event titles, descriptions, locations or guests. It also reads the names of your calendars, so you can pick which ones count.</p>

      <h2 className="h2">What Soon writes</h2>
      <p>When both of you agree to a plan, Soon adds one event for it to your main Google Calendar, with the title and privacy setting you picked. If the plan is cancelled, Soon removes that event. It doesn’t touch any other events.</p>

      <h2 className="h2">What Soon stores</h2>
      <p>Your Google email, an encrypted Google access token, the plans you make, your Free / Maybe / Can’t answers, and the details your phone needs to receive notifications. It doesn’t store your calendar events or their contents.</p>

      <h2 className="h2">Sharing</h2>
      <p>Nothing is sold, shared, or used for advertising, and Soon has no analytics or tracking. Data lives in a Postgres database (Neon) and the app runs on Vercel.</p>
      <p>Soon’s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

      <h2 className="h2">Leaving</h2>
      <p>You can disconnect at any time at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. To have your data deleted, ask {maker.name}{maker.email ? <> at <a href={`mailto:${maker.email}`}>{maker.email}</a></> : null}.</p>

      <p className="small faint" style={{ marginTop: 12 }}>{appUrl()}</p>
    </main>
  );
}
