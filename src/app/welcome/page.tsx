import { redirect } from "next/navigation";
import { WelcomeView } from "@/components/WelcomeView";
import { isDemo } from "@/lib/config";
import { currentPersonId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Welcome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentPersonId()) redirect("/");
  const { error } = await searchParams;
  return <WelcomeView error={error} continueHref="/api/auth/google" demo={isDemo()} />;
}
