import Link from "next/link";
import { Sunflower } from "@/components/Sunflower";

export default function NotFound() {
  return (
    <main className="screen screen--plain screen--center" style={{ alignItems: "center", textAlign: "center", gap: 18 }}>
      <Sunflower bloom={0.15} size={72} />
      <h1 className="title" style={{ fontSize: 28 }}>Nothing here yet.</h1>
      <Link href="/" className="btn">Back to Soon</Link>
    </main>
  );
}
