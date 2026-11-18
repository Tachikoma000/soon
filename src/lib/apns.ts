// Apple Push Notification service, spoken directly over HTTP/2 with a .p8 signing key.

import http2 from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { apnsBundleId } from "./config";

export type ApnsEnv = "sandbox" | "production";
export type ApnsPushType = "alert" | "background" | "liveactivity" | "widgets";

export type ApnsRequest = {
  token: string;
  env: ApnsEnv;
  pushType: ApnsPushType;
  payload: unknown;
  /** 10 = now, 5 = whenever it suits the phone. */
  priority?: 5 | 10;
  /** Unix seconds after which APNs stops trying. */
  expiration?: number;
  collapseId?: string;
};

export type ApnsResult = { token: string; status: number; reason?: string };

const HOSTS: Record<ApnsEnv, string> = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

function topicFor(type: ApnsPushType): string {
  const id = apnsBundleId();
  if (type === "liveactivity") return `${id}.push-type.liveactivity`;
  if (type === "widgets") return `${id}.push-type.widgets`;
  return id;
}

/** The key may be pasted as a whole .p8 file, with escaped newlines, base64'd, or as just its body. */
function pem(): string {
  const raw = (process.env.APNS_KEY || "").trim();
  if (raw.includes("BEGIN PRIVATE KEY")) return raw.replace(/\\n/g, "\n");
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.includes("BEGIN PRIVATE KEY")) return decoded;
  } catch {}
  const body = raw.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

let signed: { jwt: string; at: number } | null = null;

/** Apple wants a fresh provider token at least hourly and no more than every 20 minutes. */
async function providerToken(): Promise<string> {
  if (signed && Date.now() - signed.at < 45 * 60_000) return signed.jwt;
  const key = await importPKCS8(pem(), "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID as string })
    .setIssuer(process.env.APNS_TEAM_ID as string)
    .setIssuedAt()
    .sign(key);
  signed = { jwt, at: Date.now() };
  return jwt;
}

function origin(env: ApnsEnv): string {
  return process.env.APNS_ORIGIN || HOSTS[env];
}

function sendOne(client: http2.ClientHttp2Session, jwt: string, r: ApnsRequest): Promise<ApnsResult> {
  return new Promise((resolve) => {
    const headers: http2.OutgoingHttpHeaders = {
      ":method": "POST",
      ":path": `/3/device/${r.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": topicFor(r.pushType),
      "apns-push-type": r.pushType,
      "apns-priority": String(r.priority ?? (r.pushType === "background" ? 5 : 10)),
      "content-type": "application/json",
    };
    if (r.expiration !== undefined) headers["apns-expiration"] = String(r.expiration);
    if (r.collapseId) headers["apns-collapse-id"] = r.collapseId.slice(0, 64);

    let status = 0;
    let body = "";
    const req = client.request(headers);
    const timer = setTimeout(() => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      resolve({ token: r.token, status: 0, reason: "Timeout" });
    }, 10_000);
    req.setEncoding("utf8");
    req.on("response", (h) => {
      status = Number(h[":status"]);
    });
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      clearTimeout(timer);
      let reason: string | undefined;
      try {
        reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined;
      } catch {}
      resolve({ token: r.token, status, reason });
    });
    req.on("error", (e) => {
      clearTimeout(timer);
      resolve({ token: r.token, status: 0, reason: String(e) });
    });
    req.end(JSON.stringify(r.payload));
  });
}

/** Send a batch of pushes, one connection per APNs environment. */
export async function sendApns(reqs: ApnsRequest[]): Promise<ApnsResult[]> {
  if (!reqs.length) return [];
  const jwt = await providerToken();
  const out: ApnsResult[] = [];
  for (const env of ["production", "sandbox"] as const) {
    const batch = reqs.filter((r) => r.env === env);
    if (!batch.length) continue;
    const ca = process.env.APNS_TEST_CA;
    const client = http2.connect(origin(env), ca ? { ca } : {});
    client.on("error", () => {});
    try {
      out.push(...(await Promise.all(batch.map((r) => sendOne(client, jwt, r)))));
    } finally {
      client.close();
    }
  }
  return out;
}

/** The token is gone for good (app deleted, or it belongs to another build). */
export function isDeadToken(r: ApnsResult): boolean {
  return r.status === 410 || (r.status === 400 && (r.reason === "BadDeviceToken" || r.reason === "DeviceTokenNotForTopic"));
}

/** For tests: forget the cached provider token. */
export function resetApnsForTests(): void {
  signed = null;
}
