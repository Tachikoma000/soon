import { cookies } from "next/headers";
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

/** Who is looking, or null if nobody is signed in. */
export async function currentPersonId(): Promise<string | null> {
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
