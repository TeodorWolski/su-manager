"use server";

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, passkeys } from "@/db";
import { relyingParty, requireSession } from "@/lib/auth";
import { cookieOptions, revokeOtherSessions, revokeSession, SESSION_COOKIE } from "@/lib/session";

const CHALLENGE_COOKIE = "sum_wa_register";
/** Stały identyfikator jedynego użytkownika — passkey „wie”, do jakiego konta należy. */
const USER_ID = new TextEncoder().encode("su-manager-owner");

/** Krok 1 dodawania passkeya (tylko zalogowany): opcje dla przeglądarki, wyzwanie w ciasteczku. */
export async function passkeyRegisterOptions() {
  await requireSession();
  const { rpID, rpName } = await relyingParty();
  const existing = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: "SU Manager",
    userID: USER_ID,
    attestationType: "none",
    // Ten sam telefon nie doda drugiego passkeya dla tej apki.
    excludeCredentials: existing.map((k) => ({ id: k.id, transports: k.transports ? JSON.parse(k.transports) : undefined })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  (await cookies()).set(CHALLENGE_COOKIE, options.challenge, { ...cookieOptions, maxAge: 300 });
  return options;
}

/** Krok 2: weryfikacja i zapis klucza publicznego. */
export async function passkeyRegister(response: RegistrationResponseJSON, name: string): Promise<{ error?: string }> {
  await requireSession();
  const jar = await cookies();
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  if (!challenge) return { error: "Minął czas — spróbuj jeszcze raz." };
  const { rpID, origin } = await relyingParty();
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verified) return { error: "Nie udało się dodać Face ID." };
    const c = registrationInfo.credential;
    await db
      .insert(passkeys)
      .values({
        id: c.id,
        publicKey: Buffer.from(c.publicKey).toString("base64url"),
        counter: c.counter,
        transports: c.transports ? JSON.stringify(c.transports) : null,
        name: name.slice(0, 60) || "Passkey",
      })
      .onConflictDoNothing();
  } catch {
    return { error: "Nie udało się dodać Face ID." };
  }
  refresh();
  return {};
}

export async function deletePasskey(id: string) {
  await requireSession();
  await db.delete(passkeys).where(eq(passkeys.id, id));
  refresh();
}

export async function logoutDevice(hash: string) {
  const s = await requireSession();
  await revokeSession(hash);
  if (hash === s.hash) await logout();
  refresh();
}

export async function logoutOthers() {
  const s = await requireSession();
  await revokeOtherSessions(s.hash);
  refresh();
}

/** Wyloguj to urządzenie. */
export async function logout() {
  const s = await requireSession();
  await revokeSession(s.hash);
  (await cookies()).delete({ name: SESSION_COOKIE, path: cookieOptions.path });
  redirect("/login");
}
