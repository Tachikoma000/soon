export type PersonConfig = {
  id: string;
  name: string;
  email: string;
  home: string;
};

const DEMO_PEOPLE: PersonConfig[] = [
  { id: "tachi", name: "Tachi", email: "tachi@example.com", home: "San Antonio" },
  { id: "annie", name: "Annie", email: "annie@example.com", home: "Austin" },
];

let cached: PersonConfig[] | null = null;

/** The two people this app is for. The first one is "the maker". */
export function people(): PersonConfig[] {
  if (cached) return cached;
  const raw = process.env.SOON_PEOPLE;
  if (!raw) {
    cached = DEMO_PEOPLE;
    return cached;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SOON_PEOPLE must be a JSON array of two people");
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new Error("SOON_PEOPLE must list exactly two people");
  }
  cached = parsed.map((p, i) => {
    const o = p as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.email !== "string") {
      throw new Error(`SOON_PEOPLE[${i}] needs id, name and email`);
    }
    return {
      id: o.id,
      name: o.name,
      email: o.email.toLowerCase(),
      home: typeof o.home === "string" ? o.home : o.name + "'s",
    };
  });
  return cached;
}

export function person(id: string): PersonConfig {
  const p = people().find((x) => x.id === id);
  if (!p) throw new Error(`Unknown person ${id}`);
  return p;
}

export function otherOf(id: string): PersonConfig {
  const p = people().find((x) => x.id !== id);
  if (!p) throw new Error("Need two people");
  return p;
}

export function personByEmail(email: string): PersonConfig | undefined {
  const e = email.toLowerCase();
  return people().find((p) => p.email === e);
}

export const TZ = process.env.SOON_TIMEZONE || "America/Chicago";
export const DRIVE_MINUTES = Number(process.env.SOON_DRIVE_MINUTES || 105);
export const NOTE = process.env.SOON_NOTE || "for all our weekends ahead — T";

/** Demo mode: no database configured, so the app runs on sample data. */
export function isDemo(): boolean {
  return !process.env.DATABASE_URL;
}

export function appUrl(): string {
  return (process.env.SOON_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
