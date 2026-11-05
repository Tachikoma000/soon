import { HelloSteps } from "@/components/HelloSteps";
import { isDemo, people } from "@/lib/config";
import { requireViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Right after the first sign-in: put Soon on the Home Screen, then turn on notifications. */
export default async function Hello() {
  const { me, them } = await requireViewer();
  const [maker] = people();
  return (
    <HelloSteps
      name={me.name}
      them={them.name}
      invited={me.id !== maker.id}
      publicKey={process.env.VAPID_PUBLIC_KEY ?? null}
      demo={isDemo()}
    />
  );
}
