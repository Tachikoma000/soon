import { Sunflower } from "@/components/Sunflower";

export default function Loading() {
  return (
    <main className="screen screen--plain screen--center" aria-busy="true" aria-label="Loading">
      <span className="breathe">
        <Sunflower bloom={0.35} size={44} stem={false} />
      </span>
    </main>
  );
}
