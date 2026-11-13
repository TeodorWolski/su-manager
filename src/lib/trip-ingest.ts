/**
 * Bilet przychodzący z zewnątrz (skrypt Gmaila → /api/ingest/ticket): PDF albo tekst maila → podróż
 * zapisana od razu, podpięta do pasującego grania, z powiadomieniem push. Wspólne z ekranem importu:
 * `tripContext` (grania wokół podróży, podpowiedź, czy bilet już jest).
 */
import { eq, sql } from "drizzle-orm";
import { inflateSync } from "node:zlib";
import { db, gigs, trips } from "@/db";
import { pdfText } from "./pdf-text";
import { fmtZl, parseTicket, type ParsedTicket } from "./ticket-parse";
import { addDays } from "./time";
import { suggestGig } from "./trips";

type TripKey = { fromStation: string; toStation: string; departsAt: string; arrivesAt: string | null; reference: string | null };

/** Grania ±3 dni od podróży (do wyboru), podpowiedziane granie i istniejący wpis z tym numerem biletu. */
export async function tripContext(trip: TripKey) {
  const day = (n: number) => addDays(trip.departsAt, n);
  const candidates = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      startsAt: gigs.startsAt,
      cityName: sql<string | null>`coalesce((select c.name from cities c where c.id = ${gigs.cityId}),
        (select c.name from venues v join cities c on c.id = v.city_id where v.id = ${gigs.venueId}))`,
    })
    .from(gigs)
    .where(sql`${gigs.startsAt} >= ${day(-3)} and ${gigs.startsAt} < ${day(4)} and ${gigs.status} not in ('rejected', 'cancelled')`)
    .orderBy(gigs.startsAt);
  const [existing] = trip.reference
    ? await db.select({ id: trips.id, gigId: trips.gigId }).from(trips).where(eq(trips.reference, trip.reference))
    : [];
  return { gigs: candidates, suggested: suggestGig(trip, candidates)?.id ?? null, existing: existing ?? null };
}

const dmHm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

export type IngestResult =
  | { status: "saved" | "updated"; tripId: number; gigId: number | null; ticket: ParsedTicket; gigTitle: string | null }
  | { status: "unreadable" | "not-ticket"; ticket: ParsedTicket };

/** PDF (base64) albo tekst → podróż. „not-ticket” = mail od przewoźnika, ale nie bilet (np. faktura). */
export async function ingestTicket({ pdf, text }: { pdf?: string; text?: string }): Promise<IngestResult> {
  const raw = pdf ? await pdfText(new Uint8Array(Buffer.from(pdf, "base64")), async (d) => new Uint8Array(inflateSync(d))) : (text ?? "");
  const t = parseTicket(raw);
  if (!t.fromStation || !t.toStation || !t.departsAt) {
    return { status: /BILET|Numer biletu|Numer referencyjny|Pociąg/i.test(raw) ? "unreadable" : "not-ticket", ticket: t };
  }
  const ctx = await tripContext({ fromStation: t.fromStation, toStation: t.toStation, departsAt: t.departsAt, arrivesAt: t.arrivesAt, reference: t.reference });
  // Ponowny bilet (np. drugi mail) — dane z biletu odświeżamy, ale granie zostaje takie, jak ustawiłem.
  const gigId = ctx.existing ? ctx.existing.gigId : ctx.suggested;
  const values = {
    gigId,
    carrier: t.carrier,
    train: t.train,
    fromStation: t.fromStation,
    toStation: t.toStation,
    departsAt: t.departsAt,
    arrivesAt: t.arrivesAt,
    priceGr: t.priceGr,
    seat: t.seat,
    reference: t.reference,
  };
  const [row] = ctx.existing
    ? await db.update(trips).set(values).where(eq(trips.id, ctx.existing.id)).returning({ id: trips.id })
    : await db.insert(trips).values(values).returning({ id: trips.id });
  const gigTitle = ctx.gigs.find((g) => g.id === gigId)?.title ?? null;
  return { status: ctx.existing ? "updated" : "saved", tripId: row.id, gigId, ticket: t, gigTitle };
}

/** Treść powiadomienia po automatycznym dodaniu biletu. */
export function ingestNotice(r: IngestResult) {
  if (r.status === "unreadable") {
    return { title: "🚆 Nie odczytałem biletu", body: "Przyszedł mail z biletem, ale nie umiem go odczytać — dodaj go ręcznie.", url: "/trips/import", tag: "trip-unreadable" };
  }
  if (r.status !== "saved") return null;
  const t = r.ticket;
  return {
    title: `🚆 Dodano bilet: ${t.fromStation} → ${t.toStation}`,
    body: [dmHm(t.departsAt!), t.train, t.priceGr != null && fmtZl(t.priceGr), r.gigTitle ? `do: ${r.gigTitle}` : "prywatna podróż"].filter(Boolean).join(" · "),
    url: r.gigId ? `/gigs/${r.gigId}` : "/trips",
    tag: `trip-${r.tripId}`,
  };
}
