import { MESSAGE_CHANNELS } from "./labels";
import { addDays, dayOf, daysBetween } from "./time";

/**
 * Granie „napisałem” / „czekam” bez odpowiedzi wpada do „Do ponowienia” na tyle dni przed
 * samym graniem (~1,5 tygodnia) — wtedy line-up się domyka i warto się przypomnieć.
 */
export const FOLLOW_UP_BEFORE_DAYS = 10;
/** …ale nie wcześniej niż tyle dni po ostatniej wiadomości (świeżo napisane — daj odpowiedzieć). */
export const FOLLOW_UP_MIN_QUIET_DAYS = 2;
/**
 * „Czekam” (odpisał, ale jeszcze nie wie) bez żadnego ruchu przez tyle dni — ponów od razu,
 * nawet gdy granie jest jeszcze daleko (inaczej wisiałoby tygodniami do progu 10 dni przed).
 */
export const WAITING_FOLLOW_UP_DAYS = 5;

/** Pierwszy z IG → FB prywatny → FB fanpage, którym jeszcze nie pisałem; null = wszystkie wykorzystane. */
export function nextChannel(used: readonly string[]) {
  return MESSAGE_CHANNELS.find((c) => !used.includes(c)) ?? null;
}

/**
 * Ostatni ruch w sprawie grania: późniejsza z dat — zmiana statusu albo ostatnia wiadomość.
 * Grania sprzed wprowadzenia daty zmiany statusu liczą się od utworzenia.
 */
export function lastActivity(g: { statusChangedAt: string | null; createdAt: string; lastMessageAt: string | null }) {
  const status = dayOf(g.statusChangedAt ?? g.createdAt);
  return g.lastMessageAt && g.lastMessageAt > status ? g.lastMessageAt : status;
}

export const daysSince = (date: string, today: string) => daysBetween(date, today);

/**
 * Kiedy przypomnieć o ponowieniu: dzień `remindOn` i czy to już (`due`).
 * Zawsze ~10 dni przed graniem (min. 2 dni po ostatnim ruchu); przy „czekam” dodatkowo
 * po 5 dniach ciszy — co nastąpi wcześniej.
 */
export function followUpTiming(startsAt: string, lastActivityAt: string, today: string, status?: string) {
  const byEvent = addDays(startsAt, -FOLLOW_UP_BEFORE_DAYS);
  const byQuiet = addDays(lastActivityAt, FOLLOW_UP_MIN_QUIET_DAYS);
  let remindOn = byEvent > byQuiet ? byEvent : byQuiet;
  if (status === "waiting") {
    const byWaiting = addDays(lastActivityAt, WAITING_FOLLOW_UP_DAYS);
    if (byWaiting < remindOn) remindOn = byWaiting;
  }
  return { remindOn, due: remindOn <= today };
}
