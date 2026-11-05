import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { googleConfigured, isDemo } from "@/lib/config";
import { authUrl } from "@/lib/google";

export async function GET(req: Request) {
  if (isDemo() || !googleConfigured()) {
    return NextResponse.redirect(new URL("/welcome?error=setup", req.url));
  }
  const state = randomBytes(24).toString("base64url");
  const hint = new URL(req.url).searchParams.get("hint") || undefined;
  const res = NextResponse.redirect(authUrl(state, hint));
  res.cookies.set("soon_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
