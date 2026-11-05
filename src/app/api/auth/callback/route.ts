import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { personByEmail } from "@/lib/config";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/google";
import { startSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (error: string) => NextResponse.redirect(new URL(`/welcome?error=${error}`, req.url));

  const jar = await cookies();
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

  const p = personByEmail(result.email);
  if (!p) return back("stranger");
  if (result.missingScopes.length) return back("scopes");

  const store = await getStore();
  if (result.refreshToken) await store.saveToken(p.id, encrypt(result.refreshToken));
  const s = await store.settings(p.id);
  if (!s.connected) return back("token");

  await startSession(p.id);
  return NextResponse.redirect(new URL(s.onboarded ? "/" : "/hello", req.url));
}
