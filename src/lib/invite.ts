import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./config";
import { getStore } from "./store";

export const INVITE_COOKIE = "soon_invite";

export function hashInvite(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isInviteToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);
}

/** A fresh one-time link. Making a new one replaces any earlier link for that person. */
export async function makeInvite(personId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const store = await getStore();
  await store.setInvite(personId, hashInvite(token));
  return `${appUrl()}/join/${token}`;
}

export async function inviteTarget(token: string): Promise<string | null> {
  if (!isInviteToken(token)) return null;
  const store = await getStore();
  return store.peekInvite(hashInvite(token));
}
