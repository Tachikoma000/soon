import postgres from "postgres";
import type { Plan, PersonSettings, PushSub, Road, Signal, SignalValue } from "../types";
import type { NewPlan, Store } from "./index";
import { people } from "../config";

const SCHEMA = `
create table if not exists soon_people (
  id text primary key,
  email text,
  invite_hash text,
  refresh_token text,
  event_title text,
  event_private boolean not null default true,
  include_drive boolean not null default true,
  calendars jsonb not null default '["primary"]',
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table soon_people add column if not exists share_details boolean not null default false;
create table if not exists soon_signals (
  person_id text not null,
  day date not null,
  value text not null check (value in ('free','maybe','no')),
  primary key (person_id, day)
);
create table if not exists soon_plans (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('visit','trip')),
  host text,
  title text,
  start_day date not null,
  end_day date not null,
  arrive_time text,
  note text,
  proposed_by text not null,
  status text not null default 'proposed' check (status in ('proposed','accepted','declined','cancelled')),
  event_titles jsonb not null default '{}',
  event_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create table if not exists soon_road (
  id int primary key default 1 check (id = 1),
  plan_id uuid not null,
  person_id text not null,
  left_at timestamptz not null,
  eta timestamptz not null
);
create table if not exists soon_push (
  endpoint text primary key,
  person_id text not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
`;

type Row = Record<string, unknown>;

const day = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};
const ms = (v: unknown): number => (v instanceof Date ? v.getTime() : new Date(String(v)).getTime());

function toPlan(r: Row): Plan {
  return {
    id: String(r.id),
    kind: r.kind as Plan["kind"],
    host: (r.host as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    startDay: day(r.start_day),
    endDay: day(r.end_day),
    arriveTime: (r.arrive_time as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    proposedBy: String(r.proposed_by),
    status: r.status as Plan["status"],
    eventTitles: (r.event_titles as Record<string, string>) ?? {},
    eventIds: (r.event_ids as Record<string, string>) ?? {},
    createdAt: ms(r.created_at),
    respondedAt: r.responded_at ? ms(r.responded_at) : null,
  };
}

export class PgStore implements Store {
  private sql: postgres.Sql;
  private ready: Promise<void> | null = null;

  constructor(url: string) {
    this.sql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      prepare: false,
      onnotice: () => {},
      // Dates come back as plain strings so time zones never shift a calendar day.
      types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
    });
  }

  private init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.sql.unsafe(SCHEMA);
        for (const p of people()) {
          // An email in SOON_PEOPLE wins; otherwise keep the one they joined with.
          await this.sql`
            insert into soon_people (id, email) values (${p.id}, ${p.email})
            on conflict (id) do update set email = coalesce(excluded.email, soon_people.email)`;
        }
      })().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  async settings(id: string): Promise<PersonSettings> {
    await this.init();
    const [r] = await this.sql<Row[]>`select * from soon_people where id = ${id}`;
    if (!r) throw new Error(`Unknown person ${id}`);
    return {
      id,
      eventTitle: (r.event_title as string | null) ?? null,
      eventPrivate: Boolean(r.event_private),
      includeDrive: Boolean(r.include_drive),
      calendars: (r.calendars as string[]) ?? ["primary"],
      shareDetails: Boolean(r.share_details),
      connected: Boolean(r.refresh_token),
      onboarded: Boolean(r.onboarded),
    };
  }

  async updateSettings(id: string, patch: Partial<Omit<PersonSettings, "id" | "connected">>) {
    await this.init();
    const cur = await this.settings(id);
    const next = { ...cur, ...patch };
    await this.sql`
      update soon_people set
        event_title = ${next.eventTitle},
        event_private = ${next.eventPrivate},
        include_drive = ${next.includeDrive},
        calendars = ${this.sql.json(next.calendars)},
        share_details = ${next.shareDetails},
        onboarded = ${next.onboarded},
        updated_at = now()
      where id = ${id}`;
  }

  async email(id: string) {
    await this.init();
    const [r] = await this.sql<Row[]>`select email from soon_people where id = ${id}`;
    return (r?.email as string | null) ?? null;
  }
  async findByEmail(email: string) {
    await this.init();
    const [r] = await this.sql<Row[]>`select id from soon_people where lower(email) = ${email.toLowerCase()}`;
    return r ? String(r.id) : null;
  }
  async setInvite(id: string, hash: string | null) {
    await this.init();
    await this.sql`update soon_people set invite_hash = ${hash}, updated_at = now() where id = ${id}`;
  }
  async peekInvite(hash: string) {
    await this.init();
    const [r] = await this.sql<Row[]>`select id from soon_people where invite_hash = ${hash}`;
    return r ? String(r.id) : null;
  }
  async claimInvite(hash: string, email: string) {
    await this.init();
    const e = email.toLowerCase();
    const [r] = await this.sql<Row[]>`
      update soon_people set
        refresh_token = case when lower(coalesce(email, '')) = ${e} then refresh_token else null end,
        email = ${e},
        invite_hash = null,
        updated_at = now()
      where invite_hash = ${hash}
      returning id`;
    return r ? String(r.id) : null;
  }

  async saveToken(id: string, encrypted: string) {
    await this.init();
    await this.sql`update soon_people set refresh_token = ${encrypted}, updated_at = now() where id = ${id}`;
  }
  async getToken(id: string) {
    await this.init();
    const [r] = await this.sql<Row[]>`select refresh_token from soon_people where id = ${id}`;
    return (r?.refresh_token as string | null) ?? null;
  }
  async clearToken(id: string) {
    await this.init();
    await this.sql`update soon_people set refresh_token = null where id = ${id}`;
  }

  async signals(from: string, to: string): Promise<Signal[]> {
    await this.init();
    const rows = await this.sql<Row[]>`select * from soon_signals where day between ${from} and ${to}`;
    return rows.map((r) => ({ personId: String(r.person_id), day: day(r.day), value: r.value as SignalValue }));
  }
  async setSignal(personId: string, d: string, value: SignalValue | null) {
    await this.init();
    if (value) {
      await this.sql`
        insert into soon_signals (person_id, day, value) values (${personId}, ${d}, ${value})
        on conflict (person_id, day) do update set value = excluded.value`;
    } else {
      await this.sql`delete from soon_signals where person_id = ${personId} and day = ${d}`;
    }
  }

  async plans(): Promise<Plan[]> {
    await this.init();
    const rows = await this.sql<Row[]>`select * from soon_plans order by start_day`;
    return rows.map(toPlan);
  }
  async plan(id: string) {
    await this.init();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [r] = await this.sql<Row[]>`select * from soon_plans where id = ${id}`;
    return r ? toPlan(r) : null;
  }
  async createPlan(p: NewPlan): Promise<Plan> {
    await this.init();
    const [r] = await this.sql<Row[]>`
      insert into soon_plans (kind, host, title, start_day, end_day, arrive_time, note, proposed_by, event_titles)
      values (${p.kind}, ${p.host}, ${p.title}, ${p.startDay}, ${p.endDay}, ${p.arriveTime}, ${p.note}, ${p.proposedBy}, ${this.sql.json(p.eventTitles)})
      returning *`;
    return toPlan(r);
  }
  async updatePlan(id: string, patch: Partial<Pick<Plan, "status" | "eventIds" | "eventTitles" | "respondedAt">>) {
    await this.init();
    const cur = await this.plan(id);
    if (!cur) return;
    const n = { ...cur, ...patch };
    await this.sql`
      update soon_plans set
        status = ${n.status},
        event_ids = ${this.sql.json(n.eventIds)},
        event_titles = ${this.sql.json(n.eventTitles)},
        responded_at = ${n.respondedAt ? new Date(n.respondedAt) : null}
      where id = ${id}`;
  }

  async road(): Promise<Road | null> {
    await this.init();
    const [r] = await this.sql<Row[]>`select * from soon_road where id = 1`;
    return r ? { planId: String(r.plan_id), personId: String(r.person_id), leftAt: ms(r.left_at), eta: ms(r.eta) } : null;
  }
  async setRoad(road: Road | null) {
    await this.init();
    if (!road) {
      await this.sql`delete from soon_road where id = 1`;
      return;
    }
    await this.sql`
      insert into soon_road (id, plan_id, person_id, left_at, eta)
      values (1, ${road.planId}, ${road.personId}, ${new Date(road.leftAt)}, ${new Date(road.eta)})
      on conflict (id) do update set plan_id = excluded.plan_id, person_id = excluded.person_id,
        left_at = excluded.left_at, eta = excluded.eta`;
  }

  async pushSubs(personId: string): Promise<PushSub[]> {
    await this.init();
    const rows = await this.sql<Row[]>`select * from soon_push where person_id = ${personId}`;
    return rows.map((r) => ({ endpoint: String(r.endpoint), personId: String(r.person_id), keys: r.keys as PushSub["keys"] }));
  }
  async addPushSub(s: PushSub) {
    await this.init();
    await this.sql`
      insert into soon_push (endpoint, person_id, keys) values (${s.endpoint}, ${s.personId}, ${this.sql.json(s.keys)})
      on conflict (endpoint) do update set person_id = excluded.person_id, keys = excluded.keys`;
  }
  async removePushSub(endpoint: string) {
    await this.init();
    await this.sql`delete from soon_push where endpoint = ${endpoint}`;
  }
}
