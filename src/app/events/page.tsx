import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { dismissEvent, eventToGig, hideEventTitle, setCityTravel } from "@/app/actions";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { RELATION_LABEL, RELATION_TONE } from "@/lib/labels";
import { getOpportunities, MAX_TRAVEL_MIN, NEW_FOR_DAYS, type Opportunity } from "@/lib/opportunities";
import { plural } from "@/lib/text";
import { fmtDate, fmtDateTime, fmtTravel } from "@/lib/time";
import { cn } from "@/lib/utils";

const TABS = {
  friends: "Znajomi",
  inRange: "W zasięgu",
  openMic: "Open miki",
  unknownCity: "Uzupełnij",
} as const;
type Tab = keyof typeof TABS;
const PAGE = 60;

const QUICK_TRAVEL = [
  { label: "~1 h", minutes: 60 },
  { label: "~2 h", minutes: 120 },
  { label: "~3 h", minutes: 180 },
  { label: "dalej", minutes: 300 },
];

function EventRow({ o }: { o: Opportunity }) {
  const e = o.event;
  const where = [e.venueName, e.cityName].filter(Boolean).join(", ");
  const travel = o.city?.travelMinutes != null ? fmtTravel(o.city.travelMinutes) : null;
  return (
    <div className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b">
      <a href={e.url} target="_blank" rel="noreferrer" className="group block">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[16px] leading-snug group-hover:underline">{e.title}</span>
          {o.isNew && <Pill tone="info">nowe</Pill>}
          <ExternalLink className="text-muted-foreground/60 mt-1 size-3.5 shrink-0" />
        </div>
        <div className="text-muted-foreground mt-0.5 text-[13px]">
          {[fmtDateTime(e.startsAt), where, travel, !o.inRange && o.city?.travelMinutes != null && "poza zasięgiem"]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </a>
      {o.matches.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
          {o.matches.map((m) => (
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
      <div className="mt-2.5 flex gap-2 whitespace-nowrap">
        {o.myGigId ? (
          <Link href={`/gigs/${o.myGigId}`} className="bg-primary/14 text-primary flex h-9 items-center rounded-lg px-3 text-[14px] font-medium">
            Twoje granie →
          </Link>
        ) : (
          <form action={eventToGig.bind(null, e.id)}>
            <button type="submit" className="bg-primary text-primary-foreground h-9 rounded-lg px-3 text-[14px] font-medium active:scale-95">
              Chcę zagrać
            </button>
          </form>
        )}
        <form action={dismissEvent.bind(null, e.id)}>
          <button type="submit" className="bg-secondary text-secondary-foreground h-9 rounded-lg px-3 text-[14px] active:scale-95">
            Ukryj
          </button>
        </form>
        <form action={hideEventTitle.bind(null, e.id)}>
          <button
            type="submit"
            title="Ukryj ten program we wszystkich miastach, także w przyszłych raportach"
            className="text-muted-foreground h-9 rounded-lg px-2 text-[14px] active:scale-95"
          >
            Ukryj program
          </button>
        </form>
      </div>
    </div>
  );
}

/** Miasta bez czasu dojazdu: jedno tapnięcie na miasto i wydarzenia trafiają do właściwej grupy. */
function UnknownCities({ items }: { items: Opportunity[] }) {
  const byCity = new Map<string, Opportunity[]>();
  for (const o of items) {
    const key = o.event.cityName ?? "?";
    byCity.set(key, [...(byCity.get(key) ?? []), o]);
  }
  const rows = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <Section footer={`Czas dojazdu z Warszawy w jedną stronę. W zasięgu: ≤ ${MAX_TRAVEL_MIN / 60} h albo nocleg. Dokładne wartości poprawisz w Miastach.`}>
      {rows.map(([city, list]) => (
        <div key={city} className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[16px] font-medium">{city}</span>
            <span className="text-muted-foreground text-[13px]">{plural(list.length, "wydarzenie", "wydarzenia", "wydarzeń")}</span>
          </div>
          <div className="text-muted-foreground truncate text-[13px]">
            {list.slice(0, 2).map((o) => `${fmtDate(o.event.startsAt)} ${o.event.title}`).join(" · ")}
          </div>
          {city !== "?" && (
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {QUICK_TRAVEL.map((q) => (
                <form key={q.label} action={setCityTravel.bind(null, city, q.minutes)}>
                  <button
                    type="submit"
                    className={cn(
                      "h-9 w-full rounded-lg text-[14px] font-medium active:scale-95",
                      q.minutes > MAX_TRAVEL_MIN ? "bg-secondary text-secondary-foreground" : "bg-primary/14 text-primary",
                    )}
                  >
                    {q.label}
                  </button>
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
  const tab: Tab = typeof sp.tab === "string" && sp.tab in TABS ? (sp.tab as Tab) : "friends";
  const onlyNew = sp.all !== "1";
  const limit = Math.max(PAGE, Number(sp.limit) || PAGE);

  const all = await getOpportunities();
  const lists: Record<Tab, Opportunity[]> = {
    friends: all.filter((o) => o.group === "friends"),
    inRange: all.filter((o) => o.group === "inRange" && !o.isOpenMic),
    openMic: all.filter((o) => o.isOpenMic && o.group !== "unknownCity"),
    unknownCity: all.filter((o) => o.group === "unknownCity"),
  };
  const filtered = tab === "unknownCity" || !onlyNew ? lists[tab] : lists[tab].filter((o) => o.isNew);
  const shown = filtered.slice(0, limit);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(onlyNew ? {} : { all: "1" }), ...extra });
    return `/events?${p}`;
  };

  return (
    <>
      <PageHeader title="Okazje" subtitle={`${all.filter((o) => o.isNew).length} nowych z ostatnich ${NEW_FOR_DAYS} dni`} />

      <div className="bg-muted mb-3 grid grid-cols-4 gap-1 rounded-xl p-1">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/events?tab=${t}`}
            className={cn(
              "flex h-11 flex-col items-center justify-center rounded-lg text-[12px] leading-tight font-medium transition-all sm:text-[13px]",
              t === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {TABS[t]}
            <span className="text-[11px] font-normal tabular-nums opacity-70">{lists[t].length}</span>
          </Link>
        ))}
      </div>

      {tab !== "unknownCity" && (
        <div className="mb-4 flex justify-end px-1 text-[14px]">
          <Link href={onlyNew ? qs({ all: "1" }) : `/events?tab=${tab}`} className="text-primary">
            {onlyNew ? `Pokaż wszystkie (${lists[tab].length})` : "Tylko nowe"}
          </Link>
        </div>
      )}

      {tab === "unknownCity" ? (
        lists.unknownCity.length ? <UnknownCities items={lists.unknownCity} /> : <Section><Empty>Wszystkie miasta mają czas dojazdu.</Empty></Section>
      ) : (
        <Section>
          {shown.length ? shown.map((o) => <EventRow key={o.event.id} o={o} />) : <Empty>{onlyNew ? "Nic nowego w tym tygodniu." : "Pusto."}</Empty>}
        </Section>
      )}

      {filtered.length > shown.length && tab !== "unknownCity" && (
        <Link href={qs({ limit: String(limit + PAGE) })} className="text-primary mb-7 block text-center text-[15px]">
          Pokaż kolejne ({filtered.length - shown.length})
        </Link>
      )}
    </>
  );
}
