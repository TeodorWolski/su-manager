import { MESSAGE_CHANNELS } from "./labels";

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

const daysBetween = (from: string, to: string) => Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 864e5);

/**
 * Ostatni ruch w sprawie grania: późniejsza z dat — zmiana statusu albo ostatnia wiadomość.
 * Grania sprzed wprowadzenia daty zmiany statusu liczą się od utworzenia.
 */
export function lastActivity(g: { statusChangedAt: string | null; createdAt: string; lastMessageAt: string | null }) {
  const status = (g.statusChangedAt ?? g.createdAt).slice(0, 10);
  return g.lastMessageAt && g.lastMessageAt > status ? g.lastMessageAt : status;
}

export const daysSince = (date: string, today: string) => daysBetween(date, today);

const plusDays = (date: string, n: number) => new Date(Date.parse(date.slice(0, 10)) + n * 864e5).toISOString().slice(0, 10);

/**
 * Kiedy przypomnieć o ponowieniu: dzień `remindOn` i czy to już (`due`).
 * Zawsze ~10 dni przed graniem (min. 2 dni po ostatnim ruchu); przy „czekam” dodatkowo
 * po 5 dniach ciszy — co nastąpi wcześniej.
 */
export function followUpTiming(startsAt: string, lastActivityAt: string, today: string, status?: string) {
  const byEvent = plusDays(startsAt, -FOLLOW_UP_BEFORE_DAYS);
  const byQuiet = plusDays(lastActivityAt, FOLLOW_UP_MIN_QUIET_DAYS);
  let remindOn = byEvent > byQuiet ? byEvent : byQuiet;
  if (status === "waiting") {
    const byWaiting = plusDays(lastActivityAt, WAITING_FOLLOW_UP_DAYS);
    if (byWaiting < remindOn) remindOn = byWaiting;
  }
  return { remindOn, due: remindOn <= today };
}
