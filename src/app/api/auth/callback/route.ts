import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/google";
import { hashInvite, INVITE_COOKIE, isInviteToken } from "@/lib/invite";
import { startSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const invite = jar.get(INVITE_COOKIE)?.value;
  const back = (error: string) =>
    NextResponse.redirect(new URL(isInviteToken(invite) ? `/join/${invite}?error=${error}` : `/welcome?error=${error}`, req.url));

  const expected = jar.get("soon_oauth_state")?.value;
  jar.delete("soon_oauth_state");
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("state");

  let result: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    result = await exchangeCode(code);
  } catch (e) {
    console.error(e);
    return back("google");
  }

  const store = await getStore();
  let personId = await store.findByEmail(result.email);
  const inviteFor = !personId && isInviteToken(invite) ? await store.peekInvite(hashInvite(invite)) : null;
  if (!personId && !inviteFor) return back(isInviteToken(invite) ? "used" : "stranger");
  // Check calendar access before using up an invite, so a retry still works.
  if (result.missingScopes.length) return back("scopes");
  if (!personId && isInviteToken(invite)) personId = await store.claimInvite(hashInvite(invite), result.email);
  if (!personId) return back("used");
  jar.delete(INVITE_COOKIE);

  if (result.refreshToken) await store.saveToken(personId, encrypt(result.refreshToken));
  const s = await store.settings(personId);
  if (!s.connected) return back("token");

  await startSession(personId);
  return NextResponse.redirect(new URL(s.onboarded ? "/" : "/hello", req.url));
}
