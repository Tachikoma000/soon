import Link from "next/link";

export const metadata = { title: "Terms · Soon" };

export default function Terms() {
  return (
    <main className="screen screen--plain" style={{ gap: 18, lineHeight: 1.55, fontSize: 15.5 }}>
      <Link href="/" className="back" style={{ marginBottom: 0 }}>Soon</Link>
      <h1 className="title">Terms</h1>
      <p>Soon is a personal app made for two people to plan time together. It’s offered as-is, without warranties, and isn’t available to the public.</p>
      <p>Use it to see when you’re both free and to plan visits and trips. Plans you accept are added to your Google Calendar; you can change or delete those events in Google Calendar at any time.</p>
      <p>How your information is handled is described in the <Link href="/privacy">privacy page</Link>.</p>
    </main>
  );
}
