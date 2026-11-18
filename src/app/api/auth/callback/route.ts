import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forgetBusy } from "@/lib/busy";
import { APP_SCHEME } from "@/lib/config";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, forgetAccess } from "@/lib/google";
import { hashInvite, INVITE_COOKIE, isInviteToken } from "@/lib/invite";
import { appToken, currentPersonId, startSession, ticketPerson } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const invite = jar.get(INVITE_COOKIE)?.value;
  const intent = new Set((jar.get("soon_intent")?.value ?? "").split(","));
  const sharing = intent.has("share");
  const app = intent.has("app");
  const ticket = jar.get("soon_ticket")?.value;
  jar.delete("soon_intent");
  jar.delete("soon_ticket");

  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));
  // The iPhone app waits for its own soon:// link; Safari closes as soon as it sees it.
  const toApp = (q: string) => NextResponse.redirect(`${APP_SCHEME}://${sharing ? "shared" : "signed-in"}?${q}`);
  const back = (error: string) => {
    if (app) return toApp(`error=${error}`);
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

  // Turning on sharing: it has to be the same person who asked.
  if (sharing) {
    const asking = app ? (ticket ? await ticketPerson(ticket) : null) : await currentPersonId();
    if (app && !asking) return back("state");
    if (asking && asking !== personId) return back("account");
  }

  if (result.refreshToken) {
    await store.saveToken(personId, encrypt(result.refreshToken));
    forgetAccess(personId);
  }
  const s = await store.settings(personId);
  if (!s.connected) return back("token");

  if (sharing) {
    if (!result.detailsGranted) return back("declined");
    await store.updateSettings(personId, { shareDetails: true });
    forgetBusy();
    if (app) return toApp("ok=1");
    await startSession(personId);
    return go("/settings#share");
  }
  if (app) return toApp(`token=${encodeURIComponent(await appToken(personId))}`);
  await startSession(personId);
  return go(s.onboarded ? "/" : "/hello");
}
