import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteGig, deleteGigMessage, logGigMessage, logSupportMessage, replyToGig, setGigFee, setGigStatus } from "@/app/actions";
import { ConfirmButton, NEW, PendingButton, SelectOrNew } from "@/components/form";
import { PageHeader, Pill, Row, Section, Stat } from "@/components/ios";
import { MessageComposer } from "@/components/message-composer";
import { TripRow } from "@/components/trip-row";
import { Button } from "@/components/ui/button";
import { daysSince, FOLLOW_UP_BEFORE_DAYS, followUpTiming, lastActivity, nextChannel } from "@/lib/follow-up";
import {
  GIG_CONTEXT_LABEL,
  GIG_OUTCOME_LABEL,
  GIG_PIPELINE,
  GIG_STATUS_LABEL,
  GIG_STATUS_TONE,
  REACTION_EMOJI,
} from "@/lib/labels";
import type { GigOutcome } from "@/db/schema";
import { pitchMessage, supportMessage } from "@/lib/messages";
import { getGig, listGigTrips, type GigStatus } from "@/lib/queries";
import { fmtZl } from "@/lib/ticket-parse";
import { gigBalance } from "@/lib/trips";
import { effectiveStart, fmtDate, fmtDateTime, nowLocal } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Zakończenia rozmowy o granie — kolejność = jak często się zdarzają. */
const OUTCOME_BUTTONS: [GigOutcome, string][] = [
  ["agreed", "bg-st-ok text-white col-span-2"],
  ["declined", "bg-st-rej/14 text-st-rej"],
  ["ghosted", "bg-secondary text-secondary-foreground"],
  ["slot_taken", "bg-secondary text-secondary-foreground"],
  ["no_openers", "bg-secondary text-secondary-foreground"],
];

/** Aktywny krok w kolorze swojego statusu (szary → niebieski → ochra → zieleń). */
const STEP_ACTIVE: Partial<Record<GigStatus, string>> = {
  interested: "bg-st-int text-white",
  contacted: "bg-st-con text-white",
  waiting: "bg-st-wai text-white",
  confirmed: "bg-st-ok text-white",
};

export default async function GigPage({ params }: PageProps<"/gigs/[id]">) {
  const { id } = await params;
  const [data, gigTrips] = await Promise.all([getGig(Number(id)), listGigTrips(Number(id))]);
  if (!data) notFound();
  const { gig, log } = data;
  const isPast = effectiveStart(gig.startsAt) < nowLocal();
  const stepIndex = GIG_PIPELINE.indexOf(gig.status);
  const asking = !log && (["interested", "contacted", "waiting"] as GigStatus[]).includes(gig.status);
  const used = [...new Set(data.messages.map((m) => m.channel))];
  const lastMessage = data.messages.at(-1);
  const activeSupports = data.supports.filter((x) => x.active);
  const balance = gigBalance(data.gig.feeGr, gigTrips.map((t) => t.priceGr));
  // Ostatnio pisałem przez supportu → blok „Napisz do supportu” od razu otwarty.
  const viaSupport = !!lastMessage?.contactId && lastMessage.contactId !== data.gig.headlinerId;
  const since = lastActivity({ statusChangedAt: gig.statusChangedAt, createdAt: gig.createdAt, lastMessageAt: lastMessage?.date ?? null });
  const quiet = daysSince(since, nowLocal());
  const timing = followUpTiming(gig.startsAt, since, nowLocal().slice(0, 10), gig.status);
  const next = nextChannel(used);

  return (
    <>
      <PageHeader
        title={gig.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {fmtDateTime(gig.startsAt)}
            <Pill tone={GIG_STATUS_TONE[gig.status]}>{GIG_STATUS_LABEL[gig.status]}</Pill>
            {gig.outcome && gig.outcome !== "agreed" && <Pill tone="muted">{GIG_OUTCOME_LABEL[gig.outcome]}</Pill>}
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
            lastMessage && (!lastMessage.replied || gig.status === "waiting")
              ? timing.due
                ? `Cisza od ${quiet} dni, a granie już niedługo — ${next ? `ponów na: ${next}` : "pisałeś już wszędzie"}.`
                : `Napisane ${quiet === 0 ? "dziś" : `${quiet} dni temu`} — przypomnę ${fmtDate(timing.remindOn)}${gig.status === "waiting" ? "" : `, ok. ${FOLLOW_UP_BEFORE_DAYS} dni przed graniem`}.`
              : undefined
          }
        >
          {data.messages.map((m) => (
            <div key={m.id} className="border-border/70 flex items-center gap-3 border-b px-4 py-2.5">
              <div className="min-w-0 flex-1 text-[15px]">
                {m.channel} <span className="text-muted-foreground text-[13px]">· {fmtDate(m.date)}</span>
                {m.contactId && m.contactId !== gig.headlinerId && m.contactName && (
                  <span className="text-muted-foreground text-[13px]">
                    {" "}
                    · do supportu: <Link href={`/contacts/${m.contactId}`} className="text-foreground">{m.contactName}</Link>
                  </span>
                )}
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
          {gig.headlinerId && gig.context !== "open_mic" && (
            <details className="group/support border-t" open={viaSupport}>
              <summary className="text-primary flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[15px] [&::-webkit-details-marker]:hidden">
                Napisz do supportu
                <span className="text-muted-foreground text-[13px]">
                  {activeSupports.length ? activeSupports.map((x) => x.name).join(", ") : "on zapyta headlinera"}
                </span>
              </summary>
              <div className="p-2 pt-0">
                <MessageComposer
                  message={supportMessage({ startsAt: gig.startsAt, cityName: data.cityName, headlinerName: data.headlinerName })}
                  action={logSupportMessage.bind(null, gig.id)}
                >
                  <label className="bg-card flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px]">
                    <span className="text-muted-foreground shrink-0">Support</span>
                    <SelectOrNew
                      key={data.supports.length}
                      name="supportId"
                      newName="supportName"
                      newPlaceholder="imię i nazwisko supportu"
                      defaultValue={data.supports[0]?.contactId ?? NEW}
                      options={data.supports.map((x) => ({ value: x.contactId, label: x.active ? x.name : `${x.name} (dawniej)` }))}
                    />
                  </label>
                </MessageComposer>
              </div>
            </details>
          )}
          {lastMessage && (!lastMessage.replied || gig.status === "waiting") && (
            <div className="border-t">
              <div className="text-muted-foreground px-4 pt-2.5 text-[13px]">Jak się skończyło?</div>
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {OUTCOME_BUTTONS.filter(([o]) => o !== "no_openers" || (gig.headlinerId && gig.context !== "open_mic")).map(
                  ([outcome, cls]) => (
                    <form key={outcome} action={replyToGig.bind(null, gig.id, outcome)}>
                      <PendingButton className={cn("h-10 w-full rounded-lg text-[14px] font-medium active:scale-95", cls)}>
                        {GIG_OUTCOME_LABEL[outcome]}
                      </PendingButton>
                    </form>
                  ),
                )}
                {gig.status !== "waiting" && (
                  <form action={replyToGig.bind(null, gig.id, "wait")}>
                    <PendingButton className="text-muted-foreground h-10 w-full rounded-lg text-[14px] active:scale-95">
                      Odpisał, jeszcze nie wie
                    </PendingButton>
                  </form>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      <Section
        title="Dojazd i pieniądze"
        action={
          <Link href="/trips/import" className="text-primary text-[15px]">
            + bilet
          </Link>
        }
        footer="Bilety dodasz z „Udostępnij → Dodaj do SU Manager” na stronie biletu (Podróże → Jak dodawać). Bilans = honorarium − bilety."
      >
        {gigTrips.map((t) => (
          <TripRow key={t.id} trip={t} />
        ))}
        <form action={setGigFee.bind(null, data.gig.id)} className="border-border/70 flex items-center gap-2 border-b py-2 pr-5 pl-4 has-[[data-pending]]:opacity-50">
          <label className="flex flex-1 items-center gap-3">
            <span className="text-[16px]">Honorarium</span>
            <input
              key={data.gig.feeGr ?? "none"}
              name="fee"
              inputMode="decimal"
              placeholder="0 zł"
              defaultValue={data.gig.feeGr != null ? (data.gig.feeGr / 100).toFixed(2).replace(".", ",") : ""}
              className="min-w-0 flex-1 bg-transparent text-right text-[16px] outline-none"
            />
          </label>
          <PendingButton className="text-primary h-9 shrink-0 pl-1 text-[15px]">Zapisz</PendingButton>
        </form>
        {balance && data.gig.feeGr == null ? (
          <div className="flex items-baseline justify-between px-4 py-2.5 text-[15px]">
            <span className="text-muted-foreground">Dojazd razem · wpisz honorarium, żeby zobaczyć bilans</span>
            <b className="font-semibold tabular-nums">{fmtZl(balance.costs)}</b>
          </div>
        ) : balance ? (
          <div className="flex items-baseline justify-between px-4 py-2.5 text-[15px]">
            <span className="text-muted-foreground">
              {fmtZl(balance.fee)} − bilety {fmtZl(balance.costs)}
            </span>
            <b className={cn("font-semibold tabular-nums", balance.balance < 0 ? "text-st-rej" : "text-st-ok")}>
              {balance.balance < 0 ? "−" : "+"}
              {fmtZl(Math.abs(balance.balance))}
            </b>
          </div>
        ) : (
          <div className="text-muted-foreground px-4 py-2.5 text-[14px]">Brak biletów i honorarium.</div>
        )}
      </Section>

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
