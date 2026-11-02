import Link from "next/link";
import { Empty, PageHeader, Section } from "@/components/ios";
import { TripRow } from "@/components/trip-row";
import { fmtZl } from "@/lib/ticket-parse";
import { listTrips } from "@/lib/queries";
import { nowLocal } from "@/lib/time";

/** Podróże: nadchodzące i minione, koszty dojazdów na grania w miesiącu. */
export default async function TripsPage() {
  const all = await listTrips();
  const now = nowLocal();
  const upcoming = all.filter((t) => (t.arrivesAt ?? t.departsAt) >= now).reverse();
  const past = all.filter((t) => (t.arrivesAt ?? t.departsAt) < now);
  // Koszty dojazdów na grania wg miesiąca (prywatne podróże się nie liczą).
  const byMonth = new Map<string, number>();
  for (const t of all) if (t.gigId && t.priceGr) byMonth.set(t.departsAt.slice(0, 7), (byMonth.get(t.departsAt.slice(0, 7)) ?? 0) + t.priceGr);

  return (
    <>
      <PageHeader
        title="Podróże"
        back={{ href: "/more", label: "Więcej" }}
        action={
          <Link href="/trips/import" className="text-primary text-[17px]">
            Dodaj
          </Link>
        }
      />
      <Section title="Nadchodzące" footer={<Link href="/trips/setup" className="text-primary">Jak dodawać bilety jednym tapem (iPhone i komputer)</Link>}>
        {upcoming.length ? upcoming.map((t) => <TripRow key={t.id} trip={t} showGig />) : <Empty>Brak zaplanowanych podróży.</Empty>}
      </Section>
      {byMonth.size > 0 && (
        <Section title="Dojazdy na grania" footer="Tylko podróże podpięte do grań — prywatne się nie liczą.">
          {[...byMonth].map(([m, gr]) => (
            <div key={m} className="border-border/70 flex justify-between px-4 py-2.5 text-[15px] [&:not(:last-child)]:border-b">
              <span>{`${m.slice(5, 7)}.${m.slice(0, 4)}`}</span>
              <span className="font-semibold tabular-nums">{fmtZl(gr)}</span>
            </div>
          ))}
        </Section>
      )}
      {past.length > 0 && <Section title="Minione">{past.map((t) => <TripRow key={t.id} trip={t} showGig />)}</Section>}
    </>
  );
}
