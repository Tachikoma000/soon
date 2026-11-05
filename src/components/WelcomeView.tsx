import { enterDemo } from "@/app/actions";
import { NOTE, people } from "@/lib/config";
import { CalendarIcon, CheckIcon } from "./Icons";
import { Sunflower } from "./Sunflower";

const ERRORS: Record<string, string> = {
  stranger: "Soon doesn’t know that Google account. If you were sent an invite link, open that link to join.",
  used: "This invite link has already been used. Ask for a fresh one.",
  scopes: "Soon needs the calendar boxes ticked to work. Try again and leave them checked.",
  cancelled: "No worries. Tap below whenever you’re ready.",
  setup: "Google sign-in isn’t set up yet.",
  token: "Google didn’t hand over calendar access. Try once more.",
  state: "That sign-in took a little too long. Try once more.",
  google: "Something went sideways with Google. Try once more.",
};

type Props = { error?: string; continueHref: string; demo: boolean; invited?: boolean };

export function WelcomeView({ error, continueHref, demo, invited }: Props) {
  const [maker] = people();
  return (
    <main className="screen screen--plain" style={{ gap: 0, paddingTop: "calc(var(--safe-top) + 48px)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} className="rise">
        <Sunflower bloom={1} size={108} sway />
        <p className="hand" style={{ fontSize: 27, transform: "rotate(-2deg)" }}>{NOTE}</p>
      </div>

      <div className="stack rise rise-2" style={{ marginTop: 30, gap: 12 }}>
        <h1 className="title" style={{ fontSize: 36, lineHeight: 1.08 }}>{maker.name} made this for the two of you.</h1>
        <p className="lede" style={{ fontSize: 16.5 }}>One place to see when you’re both free, and to plan the next visit or trip.</p>
      </div>

      <ul className="stack rise rise-3" style={{ marginTop: 26, gap: 14 }}>
        {[
          <>It only sees <em className="serif" style={{ fontSize: 16.5 }}>when</em> you’re busy, never what.</>,
          <>You choose how plans show up on your calendar.</>,
          <>Just the two of you. Nobody else can see it.</>,
        ].map((t, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 15, lineHeight: 1.45 }}>
            <span style={{ color: "var(--fern)", marginTop: 2 }}><CheckIcon size={18} /></span>
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <div className="stack" style={{ marginTop: "auto", paddingTop: 32 }}>
        {error && ERRORS[error] && <div className="notice" role="alert">{ERRORS[error]}</div>}
        {demo ? (
          <>
            <p className="small faint" style={{ textAlign: "center" }}>Demo mode: sample data, no Google. Look around as</p>
            <div className="btn-row">
              {people().map((p, i) => (
                <form key={p.id} action={enterDemo.bind(null, p.id)} style={{ display: "flex" }}>
                  <button type="submit" className={`btn ${i === 0 ? "btn--quiet" : ""}`} style={{ flex: 1 }}>{p.name}</button>
                </form>
              ))}
            </div>
          </>
        ) : (
          <>
            <a href={continueHref} className="btn btn--block" style={{ height: 54 }}>
              <CalendarIcon size={20} /> Continue with Google
            </a>
            <p className="small faint" style={{ textAlign: "center", fontSize: 12.5, lineHeight: 1.5 }}>
              {invited ? "Pick the Google account your calendar lives in. " : ""}Reads free and busy times only. Disconnect anytime.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
