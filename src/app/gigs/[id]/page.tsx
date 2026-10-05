import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteGig, setGigStatus } from "@/app/actions";
import { ConfirmButton } from "@/components/form";
import { PageHeader, Pill, Row, Section, Stat } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { GIG_CONTEXT_LABEL, GIG_PIPELINE, GIG_STATUS_LABEL, GIG_STATUS_TONE } from "@/lib/labels";
import { getGig } from "@/lib/queries";
import { effectiveStart, fmtDateTime, nowLocal } from "@/lib/time";
import { cn } from "@/lib/utils";

export default async function GigPage({ params }: PageProps<"/gigs/[id]">) {
  const { id } = await params;
  const data = await getGig(Number(id));
  if (!data) notFound();
  const { gig, log } = data;
  const isPast = effectiveStart(gig.startsAt) < nowLocal();
  const stepIndex = GIG_PIPELINE.indexOf(gig.status);

  return (
    <>
      <PageHeader
        title={gig.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {fmtDateTime(gig.startsAt)}
            <Pill tone={GIG_STATUS_TONE[gig.status]}>{GIG_STATUS_LABEL[gig.status]}</Pill>
          </span>
        }
        back={{ href: "/gigs", label: "Grania" }}
        action={
          <Button asChild variant="ghost" className="text-primary text-[17px]">
            <Link href={`/gigs/${gig.id}/edit`}>Edytuj</Link>
          </Button>
        }
      />

      {/* Pipeline statusów: zainteresowany → napisałem → czekam → potwierdzone */}
      {!log && (
        <Section title="Status">
          <div className="grid grid-cols-4 gap-1 p-2">
            {GIG_PIPELINE.map((s, i) => (
              <form key={s} action={setGigStatus.bind(null, gig.id, s)}>
                <button
                  type="submit"
                  className={cn(
                    "flex h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[11px] leading-tight font-medium transition-all active:scale-95 sm:text-[12px] [&>span:last-child]:max-w-full [&>span:last-child]:truncate",
                    i === stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i < stepIndex
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", i <= stepIndex ? "border-transparent" : "border-current")}>
                    {i < stepIndex ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span>{GIG_STATUS_LABEL[s]}</span>
                </button>
              </form>
            ))}
          </div>
          <div className="flex border-t">
            {(["rejected", "cancelled"] as const).map((s) => (
              <form key={s} action={setGigStatus.bind(null, gig.id, s)} className="flex-1 [&:not(:last-child)]:border-r">
                <button
                  type="submit"
                  className={cn("h-11 w-full text-[15px]", gig.status === s ? "text-destructive font-semibold" : "text-muted-foreground")}
                >
                  {GIG_STATUS_LABEL[s]}
                </button>
              </form>
            ))}
          </div>
        </Section>
      )}

      {log ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label="Mój występ" value={<span className="text-primary">★ {log.rating}</span>} />
            <Stat label="Miejsce" value={log.venueRating ? <span className="text-primary">★ {log.venueRating}</span> : "—"} />
            <Stat label="Osób" value={log.attendance ?? "—"} />
            <Stat
              label="Minuty"
              value={
                log.minutesPlayed != null ? (
                  <>
                    {log.minutesPlayed}
                    {log.minutesAvailable != null && <span className="text-muted-foreground text-[18px]">/{log.minutesAvailable}</span>}
                  </>
                ) : (
                  "—"
                )
              }
            />
          </div>
          <Section
            title="Myśli na gorąco"
            action={<Link href={`/gigs/${gig.id}/log`} className="text-primary text-[15px]">Edytuj log</Link>}
          >
            <p className="px-4 py-3 text-[16px] leading-relaxed whitespace-pre-wrap">
              {log.thoughts || <span className="text-muted-foreground">Brak notatek.</span>}
            </p>
          </Section>
          {data.bits.length > 0 && (
            <Section title="Zagrane bity">
              {data.bits.map((b) => (
                <Row key={b.id} href={`/bits/${b.id}`} title={b.name} />
              ))}
            </Section>
          )}
        </>
      ) : (
        isPast &&
        gig.status === "confirmed" && (
          <Button asChild className="mb-7 h-12 w-full rounded-xl text-[17px] font-semibold">
            <Link href={`/gigs/${gig.id}/log`}>Oceń granie</Link>
          </Button>
        )
      )}

      <Section title="Szczegóły">
        {data.venueName && (
          <Row href={gig.venueId ? `/venues/${gig.venueId}` : undefined} title="Scena" detail={data.venueName} />
        )}
        {data.cityName && <Row title="Miasto" detail={data.cityName} />}
        {gig.context && <Row title="Kontekst" detail={GIG_CONTEXT_LABEL[gig.context]} />}
        {data.headlinerName && gig.headlinerId && (
          <Row href={`/contacts/${gig.headlinerId}`} title="Przed kim" detail={data.headlinerName} />
        )}
        {gig.url && (
          <a href={gig.url} target="_blank" rel="noreferrer" className="text-primary flex min-h-12 items-center gap-2 px-4">
            <ExternalLink className="size-4" /> Otwórz link
          </a>
        )}
        {!data.venueName && !data.cityName && !gig.context && !gig.url && (
          <Row title={<span className="text-muted-foreground">Brak — uzupełnij w edycji.</span>} />
        )}
      </Section>

      {data.lineup.length > 0 && (
        <Section title="Kto jeszcze grał">
          {data.lineup.map((c) => (
            <Row key={c.id} href={`/contacts/${c.id}`} title={c.name} />
          ))}
        </Section>
      )}

      {gig.notes && (
        <Section title="Notatki">
          <p className="px-4 py-3 text-[16px] whitespace-pre-wrap">{gig.notes}</p>
        </Section>
      )}

      <Section>
        <ConfirmButton action={deleteGig.bind(null, gig.id)} confirm="Usunąć granie razem z logiem?">
          Usuń granie
        </ConfirmButton>
      </Section>
    </>
  );
}
