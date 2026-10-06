import type { Bit, Contact, GigContext, GigStatus, IgnoreReason, VenueVerdict } from "@/db/schema";

export const GIG_STATUS_LABEL: Record<GigStatus, string> = {
  interested: "Zainteresowany",
  contacted: "Napisałem",
  waiting: "Czekam",
  confirmed: "Potwierdzone",
  rejected: "Odrzucone",
  cancelled: "Odwołane",
};

/** Kolejność w pipeline — „następny krok” to kolejny element. */
export const GIG_PIPELINE: GigStatus[] = ["interested", "contacted", "waiting", "confirmed"];

export const GIG_STATUS_TONE: Record<GigStatus, Tone> = {
  interested: "neutral",
  contacted: "info",
  waiting: "warning",
  confirmed: "success",
  rejected: "danger",
  cancelled: "muted",
};

export const GIG_CONTEXT_LABEL: Record<GigContext, string> = {
  open_mic: "Open mic",
  opener: "Przed kimś",
  support: "Support",
  headline: "Headline",
  other: "Inne",
};

export const ROLE_LABEL: Record<Contact["role"], string> = {
  comedian: "Komik",
  organizer: "Organizator",
  venue: "Scena",
};

export const RELATION_LABEL: Record<Contact["relation"], string> = {
  none: "—",
  opened_for: "Open mic przed",
  supported: "Grałem support",
  played_with: "Graliśmy razem",
  want_to_play: "Chcę zagrać",
  no_reply: "Pisałem, brak odpowiedzi",
  agreed: "Zgoda na granie",
  declined: "Odmowa",
};

export const RELATION_TONE: Record<Contact["relation"], Tone> = {
  none: "muted",
  opened_for: "success",
  supported: "success",
  played_with: "success",
  want_to_play: "info",
  no_reply: "warning",
  agreed: "success",
  declined: "danger",
};

export const BIT_STATUS_LABEL: Record<Bit["status"], string> = {
  tested: "Sprawdzony",
  testing: "W testach",
  editing: "Do redakcji",
  vomit: "Vomit",
  rejected: "Odrzucony",
};

export const BIT_STATUS_TONE: Record<Bit["status"], Tone> = {
  tested: "success",
  testing: "warning",
  editing: "info",
  vomit: "muted",
  rejected: "danger",
};

export const VERDICT_LABEL: Record<VenueVerdict, string> = {
  never: "Nie wracam",
  weak: "Słabo",
  meh: "Meh, ale ujdzie",
  good: "Fajne",
  great: "Świetne",
};

/** Krótkie etykiety do przycisków szybkiej oceny. */
export const VERDICT_SHORT: Record<VenueVerdict, string> = {
  never: "Nie wracam",
  weak: "Słabo",
  meh: "Meh",
  good: "Fajne",
  great: "Świetne",
};

export const VERDICT_TONE: Record<VenueVerdict, Tone> = {
  never: "danger",
  weak: "warning",
  meh: "neutral",
  good: "success",
  great: "success",
};

export const IGNORE_REASON_LABEL: Record<IgnoreReason, string> = {
  not_interested: "Nie interesuje mnie",
  no_openers: "Nie robi open miców przed sobą",
  other: "Inny powód",
};

/** Dostępność biletów z bileterii — pełna sala to dobry moment, żeby prosić o slot. */
export const AVAILABILITY_LABEL = { last: "ostatnie bilety", sold_out: "sold out" } as const;
export const AVAILABILITY_TONE: Record<keyof typeof AVAILABILITY_LABEL, Tone> = { last: "warning", sold_out: "danger" };

/** Kanały, którymi piszę do komików — w tej kolejności proponuję ponowienie na kolejnym. */
export const MESSAGE_CHANNELS = ["Instagram", "FB prywatny", "FB fanpage"] as const;
export const CHANNELS = [...MESSAGE_CHANNELS, "WhatsApp", "SMS", "Telefon", "Mail", "Na żywo"];
export const CHANNEL_SHORT: Record<string, string> = { Instagram: "IG", "FB prywatny": "FB", "FB fanpage": "Fanpage" };

/** Reakcja na bit w danym graniu (gig_bits.reaction). */
export const REACTIONS = [
  { value: 1, emoji: "👍", label: "siadł" },
  { value: 0, emoji: "😐", label: "tak sobie" },
  { value: -1, emoji: "👎", label: "nie siadł" },
] as const;
export const REACTION_EMOJI: Record<number, string> = { 1: "👍", 0: "😐", [-1]: "👎" };

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "muted";
