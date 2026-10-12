import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { authEnabled, checkSession, SESSION_COOKIE } from "./session";

/**
 * Sesja bieżącego żądania (Server Components / Server Actions / Route Handlers).
 * Lokalnie bez APP_PASSWORD zwraca „zalogowany” bez sprawdzania.
 */
export const currentSession = cache(async () => {
  if (!authEnabled()) return { sid: "", issued: 0, hash: "local" };
  return checkSession((await cookies()).get(SESSION_COOKIE)?.value);
});

/**
 * Każda akcja serwerowa zaczyna się od tego — nie polegamy tylko na proxy
 * (akcja to POST na trasę, z której ją wołamy; zmiana matchera mogłaby zdjąć ochronę).
 */
export async function requireSession() {
  const s = await currentSession();
  if (!s) throw new Error("Brak sesji — zaloguj się ponownie");
  return s;
}

/** RP (domena) i origin dla passkeys — z nagłówków żądania (lokalnie localhost, na produkcji domena Vercela). */
export async function relyingParty() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}`, rpName: "SU Manager" };
}
