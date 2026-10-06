import { MESSAGE_CHANNELS } from "./labels";

/**
 * Granie „napisałem” / „czekam” bez odpowiedzi wpada do „Do ponowienia” na tyle dni przed
 * samym graniem (~1,5 tygodnia) — wtedy line-up się domyka i warto się przypomnieć.
 */
export const FOLLOW_UP_BEFORE_DAYS = 10;
/** …ale nie wcześniej niż tyle dni po ostatniej wiadomości (świeżo napisane — daj odpowiedzieć). */
export const FOLLOW_UP_MIN_QUIET_DAYS = 2;

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

/** Kiedy przypomnieć o ponowieniu: dzień `remindOn` i czy to już (`due`). */
export function followUpTiming(startsAt: string, lastActivityAt: string, today: string) {
  const byEvent = new Date(Date.parse(startsAt.slice(0, 10)) - FOLLOW_UP_BEFORE_DAYS * 864e5).toISOString().slice(0, 10);
  const byQuiet = new Date(Date.parse(lastActivityAt.slice(0, 10)) + FOLLOW_UP_MIN_QUIET_DAYS * 864e5).toISOString().slice(0, 10);
  const remindOn = byEvent > byQuiet ? byEvent : byQuiet;
  return { remindOn, due: remindOn <= today };
}
