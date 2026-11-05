import type { DayState } from "@/lib/availability";

export function Dot({ who, state, small }: { who: "me" | "them"; state: DayState; small?: boolean }) {
  return <span className={`dot dot--${who} dot--${state}${small ? " dot--sm" : ""}`} />;
}

export function WeekendDots({ days }: { days: Array<{ letter: string; me: DayState; them: DayState }> }) {
  return (
    <div className="dots" aria-hidden="true">
      {days.map((d, i) => (
        <div className="dots__day" key={i}>
          <span className="dots__letter">{d.letter}</span>
          <Dot who="me" state={d.me} />
          <Dot who="them" state={d.them} />
        </div>
      ))}
    </div>
  );
}

export function DotKey({ withPlanned = true, extra }: { withPlanned?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="key" aria-hidden="true">
      <span><span className="dot dot--key-f" />Free</span>
      <span><span className="dot dot--key-m" />Maybe</span>
      <span><span className="dot dot--key-b" />Busy</span>
      {withPlanned && <span><span className="dot dot--key-p" />Together</span>}
      {extra}
    </div>
  );
}
