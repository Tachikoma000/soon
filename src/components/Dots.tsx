import type { DayState } from "@/lib/availability";

/** A small mark for someone's day: a dot when busy, a dashed ring for maybe, nothing when free. */
export function Mark({ who, state, large }: { who: "me" | "them"; state: DayState; large?: boolean }) {
  if (state === "f") return null;
  const kind = state === "m" ? " mark--maybe" : state === "p" ? " mark--sun" : "";
  return <span className={`mark mark--${who}${kind}${large ? " mark--lg" : ""}`} aria-hidden="true" />;
}
