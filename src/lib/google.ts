// Thin Google OAuth + Calendar client. No SDK: just the few calls we need.

import { appUrl } from "./config";
import { decrypt } from "./crypto";
import { getStore } from "./store";
import type { Interval } from "./types";

export const SCOPES = [
  "openid",
  "email",
  "profile",
  // When you're busy, never what.
  "https://www.googleapis.com/auth/calendar.freebusy",
  // Which calendars exist, so each person can choose which ones count.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  // Add accepted plans to calendars you own.
  "https://www.googleapis.com/auth/calendar.events.owned",
];

const REQUIRED = SCOPES.slice(3);

export function redirectUri(): string {
  return `${appUrl()}/api/auth/callback`;
}

export function authUrl(state: string, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) q.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

export async function exchangeCode(code: string): Promise<{ email: string; refreshToken: string | null; missingScopes: string[] }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const t = (await res.json()) as TokenResponse;
  if (!t.id_token) throw new Error("Google did not return an id_token");
  // The id_token came straight from Google's token endpoint over TLS, so its claims can be read directly.
  const claims = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString("utf8")) as {
    email?: string;
    email_verified?: boolean;
  };
  if (!claims.email || claims.email_verified === false) throw new Error("Google account email is not verified");
  const granted = new Set(t.scope.split(" "));
  return {
    email: claims.email.toLowerCase(),
    refreshToken: t.refresh_token ?? null,
    missingScopes: REQUIRED.filter((s) => !granted.has(s)),
  };
}

export class NotConnectedError extends Error {
  constructor(public personId: string) {
    super(`${personId} needs to reconnect Google`);
  }
}

const accessCache = new Map<string, { token: string; expires: number }>();

async function accessToken(personId: string): Promise<string> {
  const hit = accessCache.get(personId);
  if (hit && hit.expires > Date.now() + 60_000) return hit.token;
  const store = await getStore();
  const sealed = await store.getToken(personId);
  if (!sealed) throw new NotConnectedError(personId);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: decrypt(sealed),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "invalid_grant") {
      await store.clearToken(personId);
      accessCache.delete(personId);
      throw new NotConnectedError(personId);
    }
    throw new Error(`Google token refresh failed (${res.status})`);
  }
  const t = (await res.json()) as TokenResponse;
  accessCache.set(personId, { token: t.access_token, expires: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

async function gcal<T>(personId: string, path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken(personId);
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 401) {
    accessCache.delete(personId);
    throw new NotConnectedError(personId);
  }
  if (!res.ok) throw new Error(`Google Calendar ${path} failed (${res.status}): ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type CalendarInfo = { id: string; name: string; primary: boolean; owned: boolean };

export async function listCalendars(personId: string): Promise<CalendarInfo[]> {
  const data = await gcal<{ items?: Array<{ id: string; summary?: string; summaryOverride?: string; primary?: boolean; accessRole: string }> }>(
    personId,
    "/users/me/calendarList?maxResults=100",
  );
  return (data.items || []).map((c) => ({
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    primary: Boolean(c.primary),
    owned: c.accessRole === "owner",
  }));
}

/** Busy times across the chosen calendars, in windows Google is happy with. */
export async function freeBusy(personId: string, calendars: string[], timeMin: number, timeMax: number): Promise<Interval[]> {
  const out: Interval[] = [];
  const WINDOW = 60 * 86400000;
  const items = (calendars.length ? calendars : ["primary"]).slice(0, 50).map((id) => ({ id }));
  for (let a = timeMin; a < timeMax; a += WINDOW) {
    const b = Math.min(timeMax, a + WINDOW);
    const data = await gcal<{ calendars: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: unknown[] }> }>(
      personId,
      "/freeBusy",
      { method: "POST", body: JSON.stringify({ timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), items }) },
    );
    for (const cal of Object.values(data.calendars || {})) {
      for (const x of cal.busy || []) out.push({ start: Date.parse(x.start), end: Date.parse(x.end) });
    }
  }
  return out;
}

export type EventInput = {
  summary: string;
  private: boolean;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
};

export async function insertEvent(personId: string, e: EventInput): Promise<string> {
  const created = await gcal<{ id: string }>(personId, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({
      summary: e.summary,
      description: "Planned in Soon.",
      start: e.start,
      end: e.end,
      visibility: e.private ? "private" : "default",
      transparency: "opaque",
      reminders: { useDefault: true },
    }),
  });
  return created.id;
}

export async function deleteEvent(personId: string, eventId: string): Promise<void> {
  try {
    await gcal<void>(personId, `/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (e) {
    // Already gone is fine.
    if (e instanceof Error && /\(410\)|\(404\)/.test(e.message)) return;
    throw e;
  }
}
