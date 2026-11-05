import type { Plan, PersonSettings, PushSub, Road, Signal, SignalValue } from "../types";
import { databaseUrl, isDemo } from "../config";

export type NewPlan = Omit<Plan, "id" | "createdAt" | "respondedAt" | "eventIds" | "status">;

export interface Store {
  settings(id: string): Promise<PersonSettings>;
  updateSettings(id: string, patch: Partial<Omit<PersonSettings, "id" | "connected">>): Promise<void>;

  /** The Google account a person signs in with (null until they've joined). */
  email(id: string): Promise<string | null>;
  findByEmail(email: string): Promise<string | null>;
  /** Store a hashed one-time invite for a person (null clears it). */
  setInvite(id: string, hash: string | null): Promise<void>;
  /** Who an invite is for, without using it up. */
  peekInvite(hash: string): Promise<string | null>;
  /** Use an invite: bind the email to that person and clear the invite. Returns the person id. */
  claimInvite(hash: string, email: string): Promise<string | null>;

  saveToken(id: string, encrypted: string): Promise<void>;
  getToken(id: string): Promise<string | null>;
  clearToken(id: string): Promise<void>;

  signals(from: string, to: string): Promise<Signal[]>;
  setSignal(personId: string, day: string, value: SignalValue | null): Promise<void>;

  plans(): Promise<Plan[]>;
  plan(id: string): Promise<Plan | null>;
  createPlan(p: NewPlan): Promise<Plan>;
  updatePlan(id: string, patch: Partial<Pick<Plan, "status" | "eventIds" | "eventTitles" | "respondedAt">>): Promise<void>;

  road(): Promise<Road | null>;
  setRoad(r: Road | null): Promise<void>;

  pushSubs(personId: string): Promise<PushSub[]>;
  addPushSub(s: PushSub): Promise<void>;
  removePushSub(endpoint: string): Promise<void>;
}

let store: Store | null = null;

export async function getStore(): Promise<Store> {
  if (store) return store;
  if (isDemo()) {
    const { DemoStore } = await import("./demo");
    store = new DemoStore();
  } else {
    const { PgStore } = await import("./pg");
    store = new PgStore(databaseUrl() as string);
  }
  return store;
}
