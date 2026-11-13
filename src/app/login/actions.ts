"use server";

import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, passkeys } from "@/db";
import { getState, setState } from "@/lib/app-state";
import { relyingParty } from "@/lib/auth";
import { secretMatches } from "@/lib/secret";
import { cookieOptions, createSession, SESSION_COOKIE } from "@/lib/session";

/** Po tylu błędnych hasłach z rzędu — blokada logowania hasłem (passkey działa dalej). */
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const CHALLENGE_COOKIE = "sum_wa_login";

type Lock = { fails: number; until: number };
const readLock = async (): Promise<Lock> => {
  try {
    return JSON.parse((await getState("login-lock")) ?? "") as Lock;
  } catch {
    return { fails: 0, until: 0 };
  }
};

/** Tylko ścieżki w obrębie apki — żadnych przekierowań na zewnątrz. */
const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");

async function startSession(method: "password" | "passkey", next: string) {
  const ua = (await headers()).get("user-agent");
  (await cookies()).set(SESSION_COOKIE, await createSession(method, ua), cookieOptions);
  // Pierwsze logowanie hasłem bez żadnego passkeya → zaproponuj Face ID.
  if (method === "password" && !(await db.select({ id: passkeys.id }).from(passkeys).limit(1)).length) {
    return "/settings/security?setup=1";
  }
  return next;
}

export async function loginWithPassword(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const lock = await readLock();
  if (lock.until > Date.now()) {
    const at = new Date(lock.until).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });
    return { error: `Za dużo prób — hasłem spróbujesz o ${at}. Face ID działa.` };
  }
  if (!secretMatches(String(fd.get("password") ?? ""), process.env.APP_PASSWORD)) {
    const fails = lock.fails + 1;
    await setState(
      "login-lock",
      JSON.stringify(fails >= MAX_FAILS ? { fails: 0, until: Date.now() + LOCK_MIN * 60_000 } : { fails, until: 0 }),
    );
    return { error: fails >= MAX_FAILS ? `Złe hasło — logowanie hasłem zablokowane na ${LOCK_MIN} min.` : "Złe hasło." };
  }
  await setState("login-lock", JSON.stringify({ fails: 0, until: 0 }));
  redirect(await startSession("password", safeNext(fd.get("next"))));
}

/** Krok 1 logowania passkeyem: wyzwanie (w ciasteczku HttpOnly na 5 min) i opcje dla przeglądarki. */
export async function passkeyLoginOptions() {
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  (await cookies()).set(CHALLENGE_COOKIE, options.challenge, { ...cookieOptions, maxAge: 300 });
  return options;
}

/** Krok 2: weryfikacja podpisu passkeya → sesja. */
export async function passkeyLogin(response: AuthenticationResponseJSON, next: string): Promise<{ error?: string; next?: string }> {
  const jar = await cookies();
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  if (!challenge) return { error: "Minął czas na Face ID — spróbuj jeszcze raz." };
  const [key] = await db.select().from(passkeys).where(eq(passkeys.id, response.id));
  if (!key) return { error: "Ten passkey nie jest zapisany w apce — zaloguj się hasłem i dodaj go w ustawieniach." };
  const { rpID, origin } = await relyingParty();
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: key.id,
        publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
        counter: key.counter,
        transports: key.transports ? JSON.parse(key.transports) : undefined,
      },
      requireUserVerification: true,
    });
    if (!verified) return { error: "Nie udało się potwierdzić Face ID." };
    await db
      .update(passkeys)
      .set({ counter: authenticationInfo.newCounter, lastUsedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(eq(passkeys.id, key.id));
  } catch {
    return { error: "Nie udało się potwierdzić Face ID." };
  }
  return { next: await startSession("passkey", safeNext(next)) };
}
