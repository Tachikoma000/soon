import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { APP_SCHEME, googleConfigured, isDemo } from "@/lib/config";
import { authUrl } from "@/lib/google";
import { INVITE_COOKIE, isInviteToken } from "@/lib/invite";

const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 900,
};

/**
 * Start signing in with Google.
 * ?share=1   also ask to read event names (the "let them see my calendar" switch)
 * ?app=1     started from the iPhone app; finish by handing it a token
 * ?ticket=…  the app's proof of who is asking, for share=1
 * ?invite=…  a one-time invite link
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const app = q.get("app") === "1";
  if (isDemo() || !googleConfigured()) {
    if (app) return NextResponse.redirect(`${APP_SCHEME}://signed-in?error=setup`);
    return NextResponse.redirect(new URL("/welcome?error=setup", req.url));
  }
  const share = q.get("share") === "1";
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(state, share));
  res.cookies.set("soon_oauth_state", state, cookie);
  const intent = [share && "share", app && "app"].filter(Boolean).join(",");
  if (intent) res.cookies.set("soon_intent", intent, cookie);
  else res.cookies.delete("soon_intent");
  const ticket = q.get("ticket");
  if (ticket && ticket.length < 1000) res.cookies.set("soon_ticket", ticket, cookie);
  else res.cookies.delete("soon_ticket");
  const invite = q.get("invite");
  if (isInviteToken(invite)) res.cookies.set(INVITE_COOKIE, invite, cookie);
  return res;
}
