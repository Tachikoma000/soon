export type SignalValue = "free" | "maybe" | "no";

export type Signal = {
  personId: string;
  day: string;
  value: SignalValue;
};

export type PlanKind = "visit" | "trip";
export type PlanStatus = "proposed" | "accepted" | "declined" | "cancelled";

export type Plan = {
  id: string;
  kind: PlanKind;
  /** For a visit: the person being visited. Null for trips. */
  host: string | null;
  /** Trip name, e.g. "Winter trip". */
  title: string | null;
  startDay: string;
  endDay: string;
  /** "HH:MM" arrival on the first day, for visits. */
  arriveTime: string | null;
  note: string | null;
  proposedBy: string;
  status: PlanStatus;
  /** How the plan appears on each person's Google Calendar. */
  eventTitles: Record<string, string>;
  /** Google event id per person, once written. */
  eventIds: Record<string, string>;
  createdAt: number;
  respondedAt: number | null;
};

export type PersonSettings = {
  id: string;
  /** Default title for plans on this person's calendar. Null = a sensible default. */
  eventTitle: string | null;
  eventPrivate: boolean;
  includeDrive: boolean;
  /** Google calendar ids that count toward busy. */
  calendars: string[];
  connected: boolean;
  onboarded: boolean;
};

export type Road = {
  planId: string;
  personId: string;
  leftAt: number;
  eta: number;
};

export type PushSub = {
  endpoint: string;
  personId: string;
  keys: { p256dh: string; auth: string };
};

export type Interval = { start: number; end: number };
