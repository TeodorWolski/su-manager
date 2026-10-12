/**
 * Sesje logowania: podpisane ciasteczko HttpOnly na rok, przedłużane przy użyciu.
 *
 * - Ciasteczko: `<sid>.<issuedAt>.<hmac>`. Podpis kluczem wyprowadzonym z APP_PASSWORD (albo
 *   SESSION_SECRET) — zmiana hasła unieważnia wszystkie sesje.
 * - W bazie (`sessions`) tylko SHA-256 z `sid` — wyciek bazy nie daje dostępu; usunięcie wiersza =
 *   wylogowanie urządzenia. Ważność sprawdzana w bazie z krótkim cache (proxy jest wołane często).
 * - Bez APP_PASSWORD (lokalnie) logowanie jest wyłączone.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import { db, sessions } from "@/db";

export const SESSION_COOKIE = "sum_session";
const MAX_AGE_S = 365 * 24 * 3600;
/** Co ile odnawiamy ciasteczko i datę ważności w bazie (przesuwane okno roku). */
const REFRESH_AFTER_MS = 24 * 3600 * 1000;
/** Jak długo pamiętamy, że sesja jest ważna, bez pytania bazy (opóźnienie wylogowania zdalnego). */
const CACHE_MS = 60 * 1000;

export const authEnabled = () => !!process.env.APP_PASSWORD;

const secretKey = () =>
  createHmac("sha256", process.env.SESSION_SECRET || process.env.APP_PASSWORD || "")
    .update("su-manager-session-v1")
    .digest();
const sign = (payload: string) => createHmac("sha256", secretKey()).update(payload).digest("base64url");
export const hashSid = (sid: string) => createHash("sha256").update(sid).digest("hex");
const iso = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_S,
};

/** Podpis i format — bez bazy. */
function parse(value: string | undefined) {
  const [sid, issued, sig] = value?.split(".") ?? [];
  if (!sid || !issued || !sig) return null;
  const expected = Buffer.from(sign(`${sid}.${issued}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { sid, issued: Number(issued), hash: hashSid(sid) };
}

const valid = new Map<string, number>(); // hash → do kiedy uznajemy za ważną bez pytania bazy

/** Ważna sesja z ciasteczka (podpis + wiersz w bazie, z cache) albo null. */
export async function checkSession(value: string | undefined) {
  const p = parse(value);
  if (!p) return null;
  if ((valid.get(p.hash) ?? 0) > Date.now()) return p;
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, p.hash), gt(sessions.expiresAt, iso(Date.now()))));
  if (!row) {
    valid.delete(p.hash);
    return null;
  }
  valid.set(p.hash, Date.now() + CACHE_MS);
  return p;
}

/** Nowa sesja → wartość ciasteczka. */
export async function createSession(method: "password" | "passkey", userAgent: string | null) {
  const sid = randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.insert(sessions).values({
    id: hashSid(sid),
    method,
    userAgent: userAgent?.slice(0, 300) ?? null,
    lastSeenAt: iso(now),
    expiresAt: iso(now + MAX_AGE_S * 1000),
  });
  return `${sid}.${now}.${sign(`${sid}.${now}`)}`;
}

/** Raz dziennie: przesuń ważność o rok i wydaj świeże ciasteczko (null = jeszcze nie trzeba). */
export async function refreshSession(s: { sid: string; issued: number; hash: string }) {
  const now = Date.now();
  if (now - s.issued < REFRESH_AFTER_MS) return null;
  await db
    .update(sessions)
    .set({ lastSeenAt: iso(now), expiresAt: iso(now + MAX_AGE_S * 1000) })
    .where(eq(sessions.id, s.hash));
  return `${s.sid}.${now}.${sign(`${s.sid}.${now}`)}`;
}

export async function revokeSession(hash: string) {
  valid.delete(hash);
  await db.delete(sessions).where(eq(sessions.id, hash));
}

/** Wyloguj wszystkie urządzenia poza bieżącym. */
export async function revokeOtherSessions(currentHash: string) {
  valid.clear();
  await db.delete(sessions).where(ne(sessions.id, currentHash));
}
