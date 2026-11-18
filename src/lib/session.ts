import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { isDemo, otherOf, people, person, type PersonConfig } from "./config";

const SESSION = "soon_session";
const DEMO_AS = "soon_demo_as";
const MAX_AGE = 60 * 60 * 24 * 90;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set (run npm run keys)");
  return new TextEncoder().encode(s);
}

export async function startSession(personId: string): Promise<void> {
  const token = await new SignJWT({ pid: personId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION);
  jar.delete(DEMO_AS);
}

export async function setDemoViewer(id: string): Promise<void> {
  (await cookies()).set(DEMO_AS, id, { path: "/", sameSite: "lax", maxAge: MAX_AGE });
}

// ── The iPhone app ────────────────────────────────────────────────────
// The app keeps a long-lived token in the Keychain and sends it as "Authorization: Bearer …".

const APP_AUDIENCE = "soon-app";
const TICKET_AUDIENCE = "soon-ticket";

export async function appToken(personId: string): Promise<string> {
  return new SignJWT({ pid: personId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(APP_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("400d")
    .sign(secret());
}

/** A ten-minute pass so a Google round trip started in the app knows who started it. */
export async function ticketFor(personId: string): Promise<string> {
  return new SignJWT({ pid: personId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(TICKET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

async function verifiedPerson(token: string, audience: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience });
    const pid = payload.pid;
    return typeof pid === "string" && people().some((p) => p.id === pid) ? pid : null;
  } catch {
    return null;
  }
}

export function ticketPerson(ticket: string): Promise<string | null> {
  return verifiedPerson(ticket, TICKET_AUDIENCE);
}

/** undefined: no bearer header at all. null: a bearer header that doesn't check out. */
async function bearerPerson(): Promise<string | null | undefined> {
  const h = (await headers()).get("authorization");
  if (!h || !/^Bearer\s/i.test(h)) return undefined;
  const token = h.replace(/^Bearer\s+/i, "").trim();
  if (isDemo()) {
    const id = token.replace(/^demo:/, "");
    return people().some((p) => p.id === id) ? id : null;
  }
  return verifiedPerson(token, APP_AUDIENCE);
}

/** Who is looking, or null if nobody is signed in. */
export async function currentPersonId(): Promise<string | null> {
  const bearer = await bearerPerson();
  if (bearer !== undefined) return bearer;
  const jar = await cookies();
  if (isDemo()) {
    const as = jar.get(DEMO_AS)?.value;
    return people().some((p) => p.id === as) ? (as as string) : null;
  }
  const token = jar.get(SESSION)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const pid = payload.pid;
    return typeof pid === "string" && people().some((p) => p.id === pid) ? pid : null;
  } catch {
    return null;
  }
}

export type Viewer = { me: PersonConfig; them: PersonConfig };

export async function requireViewer(): Promise<Viewer> {
  const id = await currentPersonId();
  if (!id) redirect("/welcome");
  return { me: person(id), them: otherOf(id) };
}
