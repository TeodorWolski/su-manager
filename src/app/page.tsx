import { Plus } from "lucide-react";
import Link from "next/link";
import { GigRow } from "@/components/gig-row";
import { GigGoalCard, MaterialGoalCard } from "@/components/goals";
import { Empty, PageHeader, Rating, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/queries";
import { getGoals } from "@/lib/goals";
import { fmtDate, fmtDateLong, nowLocal } from "@/lib/time";

export default async function Home() {
  const [{ upcoming, pipeline, month, recent }, goals] = await Promise.all([getDashboard(), getGoals()]);
  const today = nowLocal();

  return (
    <>
      <PageHeader
        title="Dziś"
        subtitle={<span className="capitalize">{fmtDateLong(today)}</span>}
        action={
          <Button asChild size="icon-lg" className="rounded-full">
            <Link href="/gigs/new" aria-label="Nowe granie">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />

      <div className="mb-7 grid gap-3 md:grid-cols-2">
        <GigGoalCard goals={goals} avgRating={month.avg} />
        <MaterialGoalCard goals={goals} />
      </div>

      <Section title="Nadchodzące">
        {upcoming.length ? upcoming.map((g) => <GigRow key={g.id} gig={g} />) : <Empty>Brak potwierdzonych grań.</Empty>}
      </Section>

      {pipeline.length > 0 && (
        <Section title="W toku" footer="Grania, o które się starasz — zmień status, gdy coś się ruszy.">
          {pipeline.map((g) => (
            <GigRow key={g.id} gig={g} showStatus />
          ))}
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Ostatnie myśli" action={<Link href="/thoughts" className="text-primary text-[15px]">Wszystkie</Link>}>
          {recent.map((t) => (
            <Row
              key={t.gigId}
              href={`/gigs/${t.gigId}`}
              title={<span className="line-clamp-2 whitespace-normal">{t.thoughts}</span>}
              subtitle={`${fmtDate(t.startsAt)} · ${t.venueName ?? t.title}`}
              detail={<Rating value={t.rating} />}
            />
          ))}
        </Section>
      )}
    </>
  );
}
