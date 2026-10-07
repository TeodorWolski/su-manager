/** Drobny stan aplikacji (klucz → wartość) w bazie — np. „poranny mail wysłany dnia X”. Bez server-only (skrypty). */
import { eq } from "drizzle-orm";
import { appState, db } from "@/db";

export async function getState(key: string) {
  const [row] = await db.select({ value: appState.value }).from(appState).where(eq(appState.key, key));
  return row?.value ?? null;
}

export async function setState(key: string, value: string) {
  await db
    .insert(appState)
    .values({ key, value })
    .onConflictDoUpdate({ target: appState.key, set: { value, updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) } });
}

/**
 * Raz dziennie: true, jeśli `key` nie był jeszcze dziś „zużyty” (i od razu go zużywa).
 * Główny i zapasowy przebieg crona nie wyślą wtedy dwóch maili. `force` = wyślij mimo to.
 */
export async function oncePerDay(key: string, today: string, force = false) {
  if (!force && (await getState(key)) === today) return false;
  await setState(key, today);
  return true;
}
