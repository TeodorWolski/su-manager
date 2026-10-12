/**
 * Z jakim wyprzedzeniem pisać do danego komika — uczone z wyników rozmów.
 *
 * Dla każdej rozmowy z wynikiem: ile dni przed graniem poszła pierwsza wiadomość.
 * - „Zgodził się” → takie wyprzedzenie działa (bierzemy medianę),
 * - „Ktoś zajął miejsce” → takie wyprzedzenie było za małe (trzeba wcześniej),
 * - odmowa / ghosting / „nie robi open miców” nic nie mówią o czasie — pomijamy.
 * Komik z min. PERSONAL_MIN rozmowami dostaje własne wyprzedzenie; reszta — ogólne (osobno open miki
 * i grania przed komikiem), a przy zbyt małej liczbie danych DEFAULT_LEAD_DAYS. Czysta logika.
 */
export const DEFAULT_LEAD_DAYS = 14;
/** Od tylu rozmów (zgody + „zajęte”) komik ma własne wyprzedzenie. */
export const PERSONAL_MIN = 2;
/** Od tylu rozmów liczymy ogólne wyprzedzenie zamiast domyślnych 14 dni. */
export const GLOBAL_MIN = 5;
/** Zapas ponad wyprzedzenie, przy którym miejsce było już zajęte. */
const TAKEN_MARGIN = 3;
const MIN_LEAD = 5;
const MAX_LEAD = 42;

export type LeadRecord = {
  contactId: number | null;
  /** "open_mic" albo inne (przed komikiem / support). */
  context: string | null;
  gigDate: string; // YYYY-MM-DD…
  firstMessage: string; // YYYY-MM-DD
  outcome: string;
};

export type Lead = {
  days: number;
  /** Własne (z rozmów z tym komikiem) czy ogólne / domyślne. */
  personal: boolean;
  agreed: number;
  taken: number;
};

const daysBefore = (r: LeadRecord) => Math.round((Date.parse(r.gigDate.slice(0, 10)) - Date.parse(r.firstMessage.slice(0, 10))) / 864e5);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Zalecane wyprzedzenie z listy rozmów (null = za mało danych). */
export function recommend(records: LeadRecord[], min: number, fallback = DEFAULT_LEAD_DAYS): Lead | null {
  const timed = records.filter((r) => (r.outcome === "agreed" || r.outcome === "slot_taken") && daysBefore(r) >= 0);
  if (timed.length < min) return null;
  const agreed = timed.filter((r) => r.outcome === "agreed").map(daysBefore);
  const taken = timed.filter((r) => r.outcome === "slot_taken").map(daysBefore);
  let days = agreed.length ? median(agreed) : fallback;
  if (taken.length) days = Math.max(days, Math.max(...taken) + TAKEN_MARGIN);
  return { days: Math.min(MAX_LEAD, Math.max(MIN_LEAD, days)), personal: false, agreed: agreed.length, taken: taken.length };
}

export function buildLeadTimes(records: LeadRecord[]) {
  const isOpenMic = (r: LeadRecord) => r.context === "open_mic";
  const general = {
    openMic: recommend(records.filter(isOpenMic), GLOBAL_MIN),
    opener: recommend(records.filter((r) => !isOpenMic(r)), GLOBAL_MIN),
  };
  const byContact = new Map<number, Lead>();
  const grouped = new Map<number, LeadRecord[]>();
  for (const r of records) if (r.contactId) grouped.set(r.contactId, [...(grouped.get(r.contactId) ?? []), r]);
  for (const [id, list] of grouped) {
    const fallback = (list.every(isOpenMic) ? general.openMic : general.opener)?.days ?? DEFAULT_LEAD_DAYS;
    const own = recommend(list, PERSONAL_MIN, fallback);
    if (own) byContact.set(id, { ...own, personal: true });
  }
  /** Wyprzedzenie dla grania: komik (jeśli ma własne) → ogólne dla typu → domyślne. */
  const leadFor = (contactId: number | null, context: string | null): Lead =>
    (contactId ? byContact.get(contactId) : undefined) ??
    (context === "open_mic" ? general.openMic : general.opener) ?? { days: DEFAULT_LEAD_DAYS, personal: false, agreed: 0, taken: 0 };
  return { byContact, general, leadFor };
}

export type LeadTimes = ReturnType<typeof buildLeadTimes>;

/** „~3 tyg.” / „~10 dni” — do podpowiedzi w UI. */
export const leadLabel = (days: number) => (days >= 14 && days % 7 <= 1 ? `~${Math.round(days / 7)} tyg.` : `~${days} dni`);
