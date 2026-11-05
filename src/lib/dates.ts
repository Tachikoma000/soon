// Calendar days are plain "YYYY-MM-DD" strings in the couple's time zone.
// Instants are epoch milliseconds.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isDay(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function dow(day: string): number {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function zoned(ms: number, tz: string) {
  const p: Record<string, number> = {};
  for (const part of dtf(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return {
    day: fmt(p.year, p.month, p.day),
    minutes: p.hour * 60 + p.minute,
    offsetMs: Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000,
  };
}

export function today(tz: string, now = Date.now()): string {
  return zoned(now, tz).day;
}

/** The instant for a wall-clock time on a day in a time zone. */
export function instantOf(day: string, minutes: number, tz: string): number {
  const [y, m, d] = parts(day);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - zoned(guess, tz).offsetMs;
  // One correction pass handles DST transitions.
  t = guess - zoned(t, tz).offsetMs;
  return t;
}

/** ISO string with offset, for Google's API (e.g. 2026-11-20T17:30:00-06:00). */
export function isoLocal(day: string, minutes: number, tz: string): string {
  const t = instantOf(day, minutes, tz);
  const off = zoned(t, tz).offsetMs / 60000;
  const sign = off < 0 ? "-" : "+";
  const a = Math.abs(off);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${day}T${hh}:${mm}:00${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(s: string | null | undefined, fallback: number): number {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return fallback;
  const [h, m] = s.split(":").map(Number);
  return Math.min(23 * 60 + 59, h * 60 + m);
}

export function minutesToHhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ── Formatting ────────────────────────────────────────────────────────

export function fmtTime(min: number, withMeridiem = true): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const base = mm === 0 ? `${h12}` : `${h12}:${String(mm).padStart(2, "0")}`;
  return withMeridiem ? `${base} ${h < 12 ? "am" : "pm"}` : base;
}

export function fmtTimeRange(a: number, b: number): string {
  const sameHalf = (a < 720) === (b < 720);
  return sameHalf ? `${fmtTime(a, false)} – ${fmtTime(b)}` : `${fmtTime(a)} – ${fmtTime(b)}`;
}

export function fmtMonthDay(day: string): string {
  const [, m, d] = parts(day);
  return `${MONTHS[m - 1]} ${d}`;
}

export function fmtDay(day: string): string {
  return `${DOW_SHORT[dow(day)]}, ${fmtMonthDay(day)}`;
}

export function fmtLongDay(day: string): string {
  const [, m, d] = parts(day);
  return `${DOW_LONG[dow(day)]}, ${MONTHS_LONG[m - 1]} ${d}`;
}

/** "Nov 20 – 22" or "Nov 27 – Dec 1" */
export function fmtRange(a: string, b: string): string {
  if (a === b) return fmtMonthDay(a);
  const [, am, ad] = parts(a);
  const [, bm, bd] = parts(b);
  if (am === bm) return `${MONTHS[am - 1]} ${ad} – ${bd}`;
  return `${MONTHS[am - 1]} ${ad} – ${MONTHS[bm - 1]} ${bd}`;
}

export function fmtDayRange(a: string, b: string): string {
  return a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`;
}

export function monthTitle(ym: string): { month: string; year: string } {
  const [y, m] = ym.split("-").map(Number);
  return { month: MONTHS_LONG[m - 1], year: String(y) };
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} m`;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** The Friday that starts the weekend containing `day` (or the next one on Mon–Thu). */
export function weekendFriday(day: string): string {
  const w = dow(day);
  if (w === 5) return day;
  if (w === 6) return addDays(day, -1);
  if (w === 0) return addDays(day, -2);
  return addDays(day, 5 - w);
}
