import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteGig, deleteGigMessage, logGigMessage, markGigReplied, setGigStatus } from "@/app/actions";
import { ConfirmButton, PendingButton } from "@/components/form";
import { PageHeader, Pill, Row, Section, Stat } from "@/components/ios";
import { MessageComposer } from "@/components/message-composer";
import { Button } from "@/components/ui/button";
import { daysSince, FOLLOW_UP_BEFORE_DAYS, followUpTiming, lastActivity, nextChannel } from "@/lib/follow-up";
import { GIG_CONTEXT_LABEL, GIG_PIPELINE, GIG_STATUS_LABEL, GIG_STATUS_TONE, REACTION_EMOJI } from "@/lib/labels";
import { pitchMessage } from "@/lib/messages";
import { getGig, type GigStatus } from "@/lib/queries";
import { effectiveStart, fmtDate, fmtDateTime, nowLocal } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Aktywny krok w kolorze swojego statusu (szary → niebieski → ochra → zieleń). */
const STEP_ACTIVE: Partial<Record<GigStatus, string>> = {
  interested: "bg-st-int text-white",
  contacted: "bg-st-con text-white",
  waiting: "bg-st-wai text-white",
  confirmed: "bg-st-ok text-white",
};

export default async function GigPage({ params }: PageProps<"/gigs/[id]">) {
  const { id } = await params;
  const data = await getGig(Number(id));
  if (!data) notFound();
  const { gig, log } = data;
  const isPast = effectiveStart(gig.startsAt) < nowLocal();
  const stepIndex = GIG_PIPELINE.indexOf(gig.status);
  const asking = !log && (["interested", "contacted", "waiting"] as GigStatus[]).includes(gig.status);
  const used = [...new Set(data.messages.map((m) => m.channel))];
  const lastMessage = data.messages.at(-1);
  const since = lastActivity({ statusChangedAt: gig.statusChangedAt, createdAt: gig.createdAt, lastMessageAt: lastMessage?.date ?? null });
  const quiet = daysSince(since, nowLocal());
  const timing = followUpTiming(gig.startsAt, since, nowLocal().slice(0, 10));
  const next = nextChannel(used);

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
                <PendingButton
                  type="submit"
                  className={cn(
                    "flex h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[11px] leading-tight font-medium transition-all active:scale-95 sm:text-[12px] [&>span:last-child]:max-w-full [&>span:last-child]:truncate",
                    i === stepIndex
                      ? STEP_ACTIVE[s]
                      : i < stepIndex
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", i <= stepIndex ? "border-transparent" : "border-current")}>
                    {i < stepIndex ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span>{GIG_STATUS_LABEL[s]}</span>
                </PendingButton>
              </form>
            ))}
          </div>
          <div className="flex border-t">
            {(["rejected", "cancelled"] as const).map((s) => (
              <form key={s} action={setGigStatus.bind(null, gig.id, s)} className="flex-1 [&:not(:last-child)]:border-r">
                <PendingButton
                  type="submit"
                  className={cn("h-11 w-full text-[15px]", gig.status === s ? (s === "rejected" ? "text-st-rej font-semibold" : "text-foreground font-semibold line-through") : "text-muted-foreground")}
                >
                  {GIG_STATUS_LABEL[s]}
                </PendingButton>
              </form>
            ))}
          </div>
        </Section>
      )}

      {asking && (
        <Section
          title="Wiadomości"
          footer={
            lastMessage && !lastMessage.replied
              ? timing.due
                ? `Cisza od ${quiet} dni, a granie już niedługo — ${next ? `ponów na: ${next}` : "pisałeś już wszędzie"}.`
                : `Napisane ${quiet === 0 ? "dziś" : `${quiet} dni temu`} — przypomnę ${fmtDate(timing.remindOn)}, ok. ${FOLLOW_UP_BEFORE_DAYS} dni przed graniem.`
              : undefined
          }
        >
          {data.messages.map((m) => (
            <div key={m.id} className="border-border/70 flex items-center gap-3 border-b px-4 py-2.5">
              <div className="min-w-0 flex-1 text-[15px]">
                {m.channel} <span className="text-muted-foreground text-[13px]">· {fmtDate(m.date)}</span>
              </div>
              {m.replied && <Pill tone="success">odpisał</Pill>}
              <form action={deleteGigMessage.bind(null, m.id)}>
                <PendingButton className="text-muted-foreground/60 hover:text-destructive px-1 text-lg" aria-label="Usuń wpis">
                  ×
                </PendingButton>
              </form>
            </div>
          ))}
          <div className="p-2">
            <MessageComposer
              message={pitchMessage({ startsAt: gig.startsAt, cityName: data.cityName, openMic: gig.context === "open_mic" })}
              action={logGigMessage.bind(null, gig.id)}
              used={used}
              next={lastMessage ? next : "Instagram"}
            />
          </div>
          {lastMessage && !lastMessage.replied && (
            <form action={markGigReplied.bind(null, gig.id)} className="border-t">
              <PendingButton className="text-primary h-11 w-full text-[15px]">Odpisał</PendingButton>
            </form>
          )}
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
                <Row key={b.id} href={`/bits/${b.id}`} title={b.name} detail={b.reaction != null && REACTION_EMOJI[b.reaction]} />
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
