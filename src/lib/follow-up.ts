import { MESSAGE_CHANNELS } from "./labels";

/** Po ilu dniach ciszy granie w statusie „napisałem” / „czekam” wpada do „Do ponowienia”. */
export const FOLLOW_UP_AFTER_DAYS = 3;

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
