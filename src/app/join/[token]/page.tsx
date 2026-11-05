import Link from "next/link";
import { redirect } from "next/navigation";
import { Sunflower } from "@/components/Sunflower";
import { WelcomeView } from "@/components/WelcomeView";
import { isDemo } from "@/lib/config";
import { inviteTarget } from "@/lib/invite";
import { currentPersonId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The invite link: the first Google account used from here becomes this person's. */
export default async function Join({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  if (isDemo()) redirect("/welcome");
  if (await currentPersonId()) redirect("/");

  const target = await inviteTarget(token);
  if (!target) {
    return (
      <main className="screen screen--plain screen--center" style={{ alignItems: "center", textAlign: "center", gap: 18 }}>
        <Sunflower bloom={0.2} size={72} />
        <h1 className="title" style={{ fontSize: 28 }}>This invite has already been used.</h1>
        <p className="lede" style={{ maxWidth: "30ch" }}>If that was you, just sign in. Otherwise ask for a fresh link.</p>
        <Link href="/welcome" className="btn">Sign in</Link>
      </main>
    );
  }
  return <WelcomeView error={error} continueHref={`/api/auth/google?invite=${encodeURIComponent(token)}`} demo={false} invited />;
}
