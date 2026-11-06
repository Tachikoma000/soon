import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forgetBusy } from "@/lib/busy";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, forgetAccess } from "@/lib/google";
import { hashInvite, INVITE_COOKIE, isInviteToken } from "@/lib/invite";
import { currentPersonId, startSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const invite = jar.get(INVITE_COOKIE)?.value;
  const sharing = jar.get("soon_intent")?.value === "share";
  jar.delete("soon_intent");
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));
  const back = (error: string) => {
    if (sharing) return go(`/settings?share=${error}#share`);
    return go(isInviteToken(invite) ? `/join/${invite}?error=${error}` : `/welcome?error=${error}`);
  };

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
  if (!personId && !inviteFor) return back(sharing ? "account" : isInviteToken(invite) ? "used" : "stranger");
  // Check calendar access before using up an invite, so a retry still works.
  if (result.missingScopes.length) return back("scopes");
  if (!personId && isInviteToken(invite)) personId = await store.claimInvite(hashInvite(invite), result.email);
  if (!personId) return back("used");
  jar.delete(INVITE_COOKIE);

  // Turning on sharing from Settings: it has to be the same person who's signed in.
  if (sharing) {
    const signedIn = await currentPersonId();
    if (signedIn && signedIn !== personId) return back("account");
  }

  if (result.refreshToken) {
    await store.saveToken(personId, encrypt(result.refreshToken));
    forgetAccess(personId);
  }
  const s = await store.settings(personId);
  if (!s.connected) return back("token");

  await startSession(personId);
  if (sharing) {
    if (!result.detailsGranted) return back("declined");
    await store.updateSettings(personId, { shareDetails: true });
    forgetBusy();
    return go("/settings#share");
  }
  return go(s.onboarded ? "/" : "/hello");
}
