import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PendingButton } from "@/components/form";
import { eventToGig, hidePerformer, messageFromEvent, setCityTravel, snoozePerformer, unsnoozeContact } from "@/app/actions";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { MessageComposer } from "@/components/message-composer";
import { isMonth, MonthChips, monthCounts } from "@/components/month-chips";
import { RELATION_LABEL, RELATION_TONE } from "@/lib/labels";
import {
  COOLDOWN_DAYS,
  getOpportunities,
  groupByPerformer,
  MAX_TRAVEL_MIN,
  NEW_FOR_DAYS,
  type Opportunity,
  type OpportunityGroup,
} from "@/lib/opportunities";
import { loadUpcomingEventsCached } from "@/lib/events-cache";
import { pitchMessage } from "@/lib/messages";
import { plural } from "@/lib/text";
import { fmtDate, fmtDateTime, fmtTravel, nowLocal } from "@/lib/time";
import { cn } from "@/lib/utils";

const TABS = {
  friends: "Znajomi",
  inRange: "W zasięgu",
  openMic: "Open miki",
  unknownCity: "Uzupełnij",
} as const;
type TabKey = keyof typeof TABS;
const PAGE = 40;

const MUTE_LABEL = { manual: "wyciszony", gig: "macie granie", played: "niedawno graliście" } as const;

const QUICK_TRAVEL = [
  { label: "~1 h", minutes: 60 },
  { label: "~2 h", minutes: 120 },
  { label: "~3 h", minutes: 180 },
  { label: "dalej", minutes: 300 },
];

const where = (o: Opportunity) =>
  [
    fmtDateTime(o.event.startsAt),
    [o.event.venueName, o.event.cityName].filter(Boolean).join(", "),
    o.city?.travelMinutes != null && fmtTravel(o.city.travelMinutes),
    !o.inRange && o.city?.travelMinutes != null && "poza zasięgiem",
  ]
    .filter(Boolean)
    .join(" · ");

function GigButton({ o, small }: { o: Opportunity; small?: boolean }) {
  const size = small ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-[14px]";
  return o.myGigId ? (
    <Link
      href={`/gigs/${o.myGigId}`}
      className={cn("bg-primary/14 text-primary flex items-center rounded-lg font-medium whitespace-nowrap", size)}
    >
      Twoje granie →
    </Link>
  ) : (
    <form action={eventToGig.bind(null, o.event.id)}>
      <PendingButton
        type="submit"
        className={cn(
          "rounded-lg font-medium whitespace-nowrap active:scale-95",
          size,
          small ? "bg-primary/14 text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        Chcę zagrać
      </PendingButton>
    </form>
  );
}

/** „Napisz ▾”: gotowa wiadomość; „Wysłałem przez …” zakłada granie w statusie „napisałem”. */
function WriteMenu({ g }: { g: OpportunityGroup }) {
  const o = g.primary;
  return (
    <details className="group/write open:basis-full">
      <summary className="bg-secondary text-secondary-foreground flex h-9 w-fit cursor-pointer list-none items-center gap-1 rounded-lg px-3 text-[14px] [&::-webkit-details-marker]:hidden">
        Napisz <ChevronDown className="size-3.5 transition-transform group-open/write:rotate-180" />
      </summary>
      <div className="bg-muted mt-2 rounded-xl p-2">
        <MessageComposer
          message={pitchMessage({ startsAt: o.event.startsAt, cityName: o.event.cityName, openMic: o.isOpenMic })}
          action={messageFromEvent}
          hidden={{ eventId: o.event.id, gigId: o.myGigId, contactId: g.performer.contactId, name: g.performer.name }}
        />
      </div>
    </details>
  );
}

/** „Ukryj ▾”: komik ląduje w CRM jako pomijany (z powodem) albo wyciszony na miesiąc. */
function HideMenu({ g }: { g: OpportunityGroup }) {
  const button = "bg-card h-10 w-full rounded-lg px-3 text-left text-[14px] active:scale-[0.98]";
  return (
    <details className="group/hide open:basis-full">
      <summary className="bg-secondary text-secondary-foreground flex h-9 w-fit cursor-pointer list-none items-center gap-1 rounded-lg px-3 text-[14px] [&::-webkit-details-marker]:hidden">
        Ukryj <ChevronDown className="size-3.5 transition-transform group-open/hide:rotate-180" />
      </summary>
      <form action={hidePerformer} className="bg-muted mt-2 space-y-1.5 rounded-xl p-2">
        {g.performer.contactId && <input type="hidden" name="contactId" value={g.performer.contactId} />}
        <label className="bg-card flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]">
          <span className="text-muted-foreground shrink-0">Komik</span>
          <input name="name" defaultValue={g.performer.name} required className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        </label>
        <PendingButton name="reason" value="not_interested" className={button}>
          Nie interesuje mnie
        </PendingButton>
        <PendingButton name="reason" value="no_openers" className={button}>
          Nie robi open miców przed sobą
        </PendingButton>
        <PendingButton formAction={snoozePerformer} className={button}>
          Wycisz na miesiąc <span className="text-muted-foreground">(np. już pisałem)</span>
        </PendingButton>
      </form>
    </details>
  );
}

function GroupCard({ g }: { g: OpportunityGroup }) {
  const o = g.primary;
  return (
    <div className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b transition-opacity has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
      <a href={o.event.url} target="_blank" rel="noreferrer" className="group block">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[16px] leading-snug group-hover:underline">{o.event.title}</span>
          {g.isNew && <Pill tone="info">nowe</Pill>}
          <ExternalLink className="text-muted-foreground/60 mt-1 size-3.5 shrink-0" />
        </div>
        <div className="text-muted-foreground mt-0.5 text-[13px]">{where(o)}</div>
      </a>

      {g.matches.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          {g.matches.map((m) => (
            <Link key={m.id} href={`/contacts/${m.id}`} className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium whitespace-nowrap">{m.name}</span>
              {m.relation !== "none" && <Pill tone={RELATION_TONE[m.relation]}>{RELATION_LABEL[m.relation]}</Pill>}
              {m.lastPlayedTogether && (
                <span className="text-muted-foreground whitespace-nowrap">wspólny wieczór {fmtDate(m.lastPlayedTogether)}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <GigButton o={o} />
        <WriteMenu g={g} />
        <HideMenu g={g} />
      </div>

      {g.others.length > 0 && (
        <details className="group/more mt-2">
          <summary className="text-primary flex cursor-pointer list-none items-center gap-1 text-[14px] [&::-webkit-details-marker]:hidden">
            Inne terminy ({g.others.length}) <ChevronDown className="size-3.5 transition-transform group-open/more:rotate-180" />
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {g.others.map((x) => (
              <div key={x.event.id} className="bg-muted/50 flex items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-3">
                <a
                  href={x.event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground min-w-0 flex-1 text-[13px] hover:underline"
                >
                  {where(x)}
                </a>
                <GigButton o={x} small />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Wyciszeni (grałeś niedawno / sam wyciszyłeś) — nie giną, tylko czekają zwinięci na dole. */
function Muted({ groups }: { groups: OpportunityGroup[] }) {
  return (
    <details className="group/muted mb-7">
      <summary className="text-muted-foreground mb-1.5 flex cursor-pointer list-none items-center gap-1 px-1 text-[12.5px] font-medium [&::-webkit-details-marker]:hidden">
        Wyciszeni · {groups.length}
        <ChevronDown className="size-3.5 transition-transform group-open/muted:rotate-180" />
      </summary>
      <Section
        footer={`Komik znika z Okazji, gdy macie granie w toku, i jeszcze na ${COOLDOWN_DAYS} dni po wspólnym wieczorze. Zmienisz to też na karcie kontaktu.`}
      >
        {groups.map((g) => {
          const m = g.matches.find((x) => x.mutedUntil) ?? g.matches[0];
          return (
            <div key={g.performer.key} className="border-border/70 flex items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b transition-opacity has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
              <Link href={`/contacts/${m.id}`} className="min-w-0 flex-1">
                <div className="truncate text-[16px]">{m.name}</div>
                <div className="text-muted-foreground truncate text-[13px]">
                  {m.muteReason ? MUTE_LABEL[m.muteReason] : "wyciszony"} do {m.mutedUntil ? fmtDate(m.mutedUntil) : "—"} ·{" "}
                  {plural(g.others.length + 1, "termin", "terminy", "terminów")}
                </div>
              </Link>
              <form action={unsnoozeContact.bind(null, m.id)}>
                <PendingButton className="text-primary h-9 px-1 text-[14px] whitespace-nowrap">
                  Pokaż teraz
                </PendingButton>
              </form>
            </div>
          );
        })}
      </Section>
    </details>
  );
}

function UnknownCities({ items }: { items: Opportunity[] }) {
  const byCity = new Map<string, Opportunity[]>();
  for (const o of items) {
    const key = o.event.cityName ?? "?";
    byCity.set(key, [...(byCity.get(key) ?? []), o]);
  }
  const rows = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <Section
      footer={`Czas dojazdu z Warszawy w jedną stronę. W zasięgu: ≤ ${MAX_TRAVEL_MIN / 60} h albo nocleg. Dokładne wartości poprawisz w Miastach.`}
    >
      {rows.map(([city, list]) => (
        <div key={city} className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b transition-opacity has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[16px] font-medium">{city}</span>
            <span className="text-muted-foreground text-[13px]">{plural(list.length, "wydarzenie", "wydarzenia", "wydarzeń")}</span>
          </div>
          <div className="text-muted-foreground truncate text-[13px]">
            {list
              .slice(0, 2)
              .map((o) => `${fmtDate(o.event.startsAt)} ${o.event.title}`)
              .join(" · ")}
          </div>
          {city !== "?" && (
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {QUICK_TRAVEL.map((q) => (
                <form key={q.label} action={setCityTravel.bind(null, city, q.minutes)}>
                  <PendingButton
                    type="submit"
                    className={cn(
                      "h-9 w-full rounded-lg text-[14px] font-medium active:scale-95",
                      q.minutes > MAX_TRAVEL_MIN ? "bg-secondary text-secondary-foreground" : "bg-primary/14 text-primary",
                    )}
                  >
                    {q.label}
                  </PendingButton>
                </form>
              ))}
            </div>
          )}
        </div>
      ))}
    </Section>
  );
}

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const tab: TabKey = typeof sp.tab === "string" && sp.tab in TABS ? (sp.tab as TabKey) : "friends";
  const month = isMonth(sp.m) ? sp.m : null;
  // Wybrany miesiąc = planuję go w całości, więc pokazuję wszystkie terminy, nie tylko nowe.
  const onlyNew = !month && sp.all !== "1";
  const limit = Math.max(PAGE, Number(sp.limit) || PAGE);

  const everything = await getOpportunities(undefined, loadUpcomingEventsCached);
  const all = month ? everything.filter((o) => o.event.startsAt.startsWith(month)) : everything;
  const of = (t: Opportunity["tab"]) => all.filter((o) => o.tab === t);
  const tabItems = everything.filter((o) => o.tab === tab);
  const months = monthCounts(tabItems, (o) => o.event.startsAt).map(({ month: m }) => ({
    month: m,
    // dla zakładek z kartami liczymy komików, dla „Uzupełnij” — miasta
    count:
      tab === "unknownCity"
        ? new Set(tabItems.filter((o) => o.event.startsAt.startsWith(m)).map((o) => o.event.cityName)).size
        : groupByPerformer(tabItems.filter((o) => o.event.startsAt.startsWith(m))).length,
  }));
  const groups = {
    friends: groupByPerformer(of("friends")),
    inRange: groupByPerformer(of("inRange")),
    openMic: groupByPerformer(of("openMic")),
  };
  const unknown = of("unknownCity");
  const muted = groupByPerformer(of("muted"));
  const counts: Record<TabKey, number> = {
    friends: groups.friends.length,
    inRange: groups.inRange.length,
    openMic: groups.openMic.length,
    unknownCity: new Set(unknown.map((o) => o.event.cityName)).size,
  };

  const list = tab === "unknownCity" ? [] : groups[tab];
  const filtered = onlyNew ? list.filter((g) => g.isNew) : list;
  const shown = filtered.slice(0, limit);
  const newCount = [...groups.friends, ...groups.inRange, ...groups.openMic].filter((g) => g.isNew).length;
  const qs = (extra: Record<string, string>) =>
    `/events?${new URLSearchParams({ tab, ...(month ? { m: month } : {}), ...(onlyNew || month ? {} : { all: "1" }), ...extra })}`;
  const monthHref = (m: string | null) => `/events?${new URLSearchParams({ tab, ...(m ? { m } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Okazje"
        subtitle={`${plural(newCount, "komik", "komików", "komików")} z nowymi terminami w ostatnich ${NEW_FOR_DAYS} dniach`}
      />

      <div className="bg-muted mb-3 grid grid-cols-4 gap-1 rounded-xl p-1">
        {(Object.keys(TABS) as TabKey[]).map((t) => (
          <Link
            key={t}
            href={`/events?${new URLSearchParams({ tab: t, ...(month ? { m: month } : {}) })}`}
            className={cn(
              "flex h-11 flex-col items-center justify-center rounded-lg text-[12px] leading-tight font-medium transition-all sm:text-[13px]",
              t === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {TABS[t]}
            <span className="text-[11px] font-normal tabular-nums opacity-70">{counts[t]}</span>
          </Link>
        ))}
      </div>

      <MonthChips months={months} active={month} href={monthHref} thisYear={nowLocal().slice(0, 4)} />

      {tab === "unknownCity" ? (
        unknown.length ? (
          <UnknownCities items={unknown} />
        ) : (
          <Section>
            <Empty>Wszystkie miasta mają czas dojazdu.</Empty>
          </Section>
        )
      ) : (
        <>
          {!month && (
            <div className="mb-4 flex justify-end px-1 text-[14px]">
              <Link href={onlyNew ? qs({ all: "1" }) : `/events?tab=${tab}`} className="text-primary">
                {onlyNew ? `Pokaż wszystkich (${list.length})` : "Tylko z nowymi terminami"}
              </Link>
            </div>
          )}
          <Section>
            {shown.length ? (
              shown.map((g) => <GroupCard key={g.performer.key} g={g} />)
            ) : (
              <Empty>{onlyNew ? "Nic nowego w tym tygodniu." : month ? "Nic w tym miesiącu." : "Pusto."}</Empty>
            )}
          </Section>
          {filtered.length > shown.length && (
            <Link href={qs({ limit: String(limit + PAGE) })} className="text-primary mb-7 block text-center text-[15px]">
              Pokaż kolejnych ({filtered.length - shown.length})
            </Link>
          )}
          {tab === "friends" && muted.length > 0 && <Muted groups={muted} />}
        </>
      )}
    </>
  );
}
