import { enterDemo } from "@/app/actions";
import { LETTER, NOTE, people } from "@/lib/config";
import { Sunflower } from "./Sunflower";

const ERRORS: Record<string, string> = {
  stranger: "Soon doesn’t know that account. Use the invite link to join.",
  used: "This invite has already been used.",
  scopes: "Soon needs the calendar boxes ticked. Try once more.",
  cancelled: "Whenever you’re ready.",
  setup: "Sign-in isn’t set up yet.",
  token: "Google didn’t share calendar access. Try once more.",
  state: "That took a little long. Try once more.",
  google: "Google hiccuped. Try once more.",
};

type Props = {
  error?: string;
  continueHref: string;
  demo: boolean;
  /** Set on the invite: who it's for, so the page can greet them. */
  invitee?: string;
};

export function WelcomeView({ error, continueHref, demo, invitee }: Props) {
  return (
    <main className="screen screen--plain" style={{ gap: 0, paddingTop: "calc(var(--safe-top) + 64px)" }}>
      <div className="rise" style={{ display: "flex", justifyContent: "center" }}>
        <Sunflower bloom={1} size={invitee ? 96 : 120} sway />
      </div>

      {invitee ? (
        <div className="stack rise rise-2" style={{ marginTop: 36, gap: 14 }}>
          <h1 className="title" style={{ fontSize: 40 }}>Hi {invitee}.</h1>
          <p className="lede" style={{ fontSize: 18.5, color: "var(--ink)" }}>{LETTER}</p>
          <p className="hand" style={{ fontSize: 28, marginTop: 6, transform: "rotate(-1.5deg)", transformOrigin: "left center" }}>{NOTE}</p>
        </div>
      ) : (
        <h1 className="rise rise-2" style={{ marginTop: 22, textAlign: "center", fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 44, letterSpacing: "-0.02em" }}>
          soon
        </h1>
      )}

      <div className="stack rise rise-3" style={{ marginTop: "auto", paddingTop: 40 }}>
        {error && ERRORS[error] && (
          <p role="alert" className="small muted" style={{ textAlign: "center", marginBottom: 4 }}>
            {ERRORS[error]}
          </p>
        )}
        {demo ? (
          <div className="btn-row">
            {people().map((p, i) => (
              <form key={p.id} action={enterDemo.bind(null, p.id)} style={{ display: "flex" }}>
                <button type="submit" className={`btn ${i === 0 ? "btn--quiet" : ""}`} style={{ flex: 1 }}>
                  {p.name}
                </button>
              </form>
            ))}
          </div>
        ) : (
          <a href={continueHref} className="btn btn--block">
            Continue with Google
          </a>
        )}
        <p className="small faint" style={{ textAlign: "center", fontSize: 13 }}>
          {demo ? "A look around, with made-up plans." : <>It only sees <em className="serif">when</em> you’re busy, never what.</>}
        </p>
      </div>
    </main>
  );
}
