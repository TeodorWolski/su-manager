/** Dane do wyprzedzenia (bez server-only — używa tego też skrypt i powiadomienia). */
import { sql } from "drizzle-orm";
import { db, gigs } from "@/db";
import { buildLeadTimes, type LeadRecord } from "./lead-time";

/**
 * Z jakim wyprzedzeniem pisać do komików — z rozmów z wynikiem (pierwsza wiadomość przy graniu
 * vs data grania). Logika: src/lib/lead-time.ts.
 */
export async function loadLeadTimes() {
  const rows = await db
    .select({
      contactId: gigs.headlinerId,
      context: gigs.context,
      gigDate: gigs.startsAt,
      outcome: gigs.outcome,
      firstMessage: sql<string | null>`(select min(i.date) from interactions i where i.gig_id = gigs.id)`,
    })
    .from(gigs)
    .where(sql`${gigs.outcome} is not null`);
  return buildLeadTimes(
    rows.flatMap((r): LeadRecord[] => (r.firstMessage && r.outcome ? [{ ...r, firstMessage: r.firstMessage, outcome: r.outcome }] : [])),
  );
}
