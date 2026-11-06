import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { googleConfigured, isDemo } from "@/lib/config";
import { authUrl } from "@/lib/google";
import { INVITE_COOKIE, isInviteToken } from "@/lib/invite";

const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 900,
};

export async function GET(req: Request) {
  if (isDemo() || !googleConfigured()) {
    return NextResponse.redirect(new URL("/welcome?error=setup", req.url));
  }
  const q = new URL(req.url).searchParams;
  const share = q.get("share") === "1";
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(state, share));
  res.cookies.set("soon_oauth_state", state, cookie);
  if (share) res.cookies.set("soon_intent", "share", cookie);
  else res.cookies.delete("soon_intent");
  const invite = q.get("invite");
  if (isInviteToken(invite)) res.cookies.set(INVITE_COOKIE, invite, cookie);
  return res;
}
