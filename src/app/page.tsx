import { Plus } from "lucide-react";
import Link from "next/link";
import { GigRow } from "@/components/gig-row";
import { GigGoalCard, MgmTile, RatingTile } from "@/components/goals";
import { Empty, PageHeader, Pill, Rating, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { FOLLOW_UP_BEFORE_DAYS } from "@/lib/follow-up";
import { CHANNEL_SHORT } from "@/lib/labels";
import { HotOpportunities } from "@/components/hot";
import { RhythmCard } from "@/components/rhythm";
import { StageCard } from "@/components/stage-card";
import { WhileThere } from "@/components/while-there";
import { WritingCard } from "@/components/writing";
import { getWriting } from "@/lib/planning";
import { getDashboard, getRhythm, getStageCard, getWhileThereCached } from "@/lib/queries";
import { getGoals } from "@/lib/goals";
import { fmtDate, fmtDateLong, nowLocal } from "@/lib/time";

export default async function Home() {
  const [{ upcoming, pipeline, followUps, month, recent }, goals, rhythm, writing, stage, whileThere] = await Promise.all([
    getDashboard(),
    getGoals(),
    getRhythm(),
    getWriting(),
    getStageCard(),
    getWhileThereCached(),
  ]);
  const today = nowLocal();

  return (
    <>
      <PageHeader
        title="Dziś"
        subtitle={<span className="capitalize">{fmtDateLong(today)}</span>}
        action={
          <Button asChild size="icon-lg" className="rounded-[10px]">
            <Link href="/gigs/new" aria-label="Nowe granie">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />

      {stage && <StageCard data={stage} />}

      <div className="mb-7 space-y-2.5">
        <GigGoalCard goals={goals} />
        <div className="grid grid-cols-2 gap-2.5">
          <MgmTile mgm={goals.mgm} />
          <RatingTile avg={month.avg} count={month.count} />
        </div>
      </div>

      <WritingCard w={writing} />

      <RhythmCard rhythm={rhythm} />

      <HotOpportunities items={rhythm.hot} />

      <WhileThere stays={whileThere} />

      <Section title="Nadchodzące">
        {upcoming.length ? upcoming.map((g) => <GigRow key={g.id} gig={g} showStatus />) : <Empty>Brak potwierdzonych grań.</Empty>}
      </Section>

      {followUps.length > 0 && (
        <Section
          title="Do ponowienia"
          footer={`Do grania ${FOLLOW_UP_BEFORE_DAYS} dni lub mniej, a odpowiedzi brak. Napisz jeszcze raz — najlepiej innym kanałem — albo zmień status.`}
        >
          {followUps.map((g) => (
            <Row
              key={g.id}
              href={`/gigs/${g.id}`}
              title={g.title}
              subtitle={[
                fmtDate(g.startsAt),
                g.headlinerName,
                g.daysLeft <= 1 ? "już jutro" : `za ${g.daysLeft} dni`,
                `cisza ${g.quietDays} dni`,
                g.used.length > 0 && `pisałeś: ${g.used.map((c) => CHANNEL_SHORT[c] ?? c).join(", ")}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              detail={g.next ? <Pill tone="info">→ {CHANNEL_SHORT[g.next] ?? g.next}</Pill> : <Pill tone="muted">wszędzie</Pill>}
            />
          ))}
        </Section>
      )}

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
