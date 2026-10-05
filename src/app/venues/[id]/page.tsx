import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteVenue } from "@/app/actions";
import { ConfirmButton } from "@/components/form";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Pill, Rating, Row, Section, Stat } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { VERDICT_LABEL, VERDICT_TONE } from "@/lib/labels";
import { getContact, getVenue, listCities } from "@/lib/queries";
import { effectiveStart, fmtTravel, nowLocal } from "@/lib/time";

export default async function VenuePage({ params }: PageProps<"/venues/[id]">) {
  const { id } = await params;
  const data = await getVenue(Number(id));
  if (!data) notFound();
  const { venue, gigs } = data;
  const [cities, organizer] = await Promise.all([
    listCities(),
    venue.organizerId ? getContact(venue.organizerId) : null,
  ]);
  const city = cities.find((c) => c.id === venue.cityId);
  const now = nowLocal();
  const played = gigs.filter((g) => g.status === "confirmed" && effectiveStart(g.startsAt) < now);
  const avg = (xs: (number | null)[]) => {
    const vals = xs.filter((x): x is number => x != null);
    return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
  };
  const myAvg = avg(gigs.map((g) => g.rating));
  const venueAvg = avg(gigs.map((g) => g.venueRating));

  return (
    <>
      <PageHeader
        title={venue.name}
        subtitle={
          <span className="flex items-center gap-2">
            {city?.name}
            {venue.verdict && <Pill tone={VERDICT_TONE[venue.verdict]}>{VERDICT_LABEL[venue.verdict]}</Pill>}
          </span>
        }
        back={{ href: "/venues", label: "Sceny" }}
        action={
          <Button asChild variant="ghost" className="text-primary text-[17px]">
            <Link href={`/venues/${venue.id}/edit`}>Edytuj</Link>
          </Button>
        }
      />
      <div className="mb-7 grid grid-cols-3 gap-3">
        <Stat label="Zagranych" value={played.length} />
        <Stat label="Mój występ" value={myAvg ? <Rating value={myAvg} /> : "—"} />
        <Stat label="Miejsce" value={venueAvg ? <Rating value={venueAvg} /> : "—"} />
      </div>
      <Section>
        {venue.recurrence && <Row title="Cykliczność" detail={venue.recurrence} />}
        <Row title="Dojazd" detail={fmtTravel(venue.travelMinutes ?? city?.travelMinutes) ?? "—"} />
        <Row title="Nocleg" detail={venue.hasLodging || city?.hasLodging ? "tak" : "nie"} />
        {organizer && <Row href={`/contacts/${organizer.contact.id}`} title="Organizator" detail={organizer.contact.name} />}
        {venue.verdictNote && <Row title="Dlaczego" detail={venue.verdictNote} />}
      </Section>
      {venue.notes && (
        <Section title="Notatki">
          <p className="px-4 py-3 text-[16px] whitespace-pre-wrap">{venue.notes}</p>
        </Section>
      )}
      <Section title="Grania">{gigs.length ? gigs.map((g) => <GigRow key={g.id} gig={g} showStatus />) : <Empty>Brak.</Empty>}</Section>
      <Section>
        <ConfirmButton action={deleteVenue.bind(null, venue.id)} confirm="Usunąć scenę? Grania zostaną, bez przypisanej sceny.">
          Usuń scenę
        </ConfirmButton>
      </Section>
    </>
  );
}
