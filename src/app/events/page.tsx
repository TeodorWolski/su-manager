import { ChevronDown, ExternalLink, MapPin, Navigation, Repeat, Search, X } from "lucide-react";
import Link from "next/link";
import { PendingButton } from "@/components/form";
import {
  eventToGig,
  hidePerformer,
  markRecurring,
  messageFromEvent,
  setCityTravel,
  snoozePerformer,
  unsnoozeContact,
} from "@/app/actions";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { MessageComposer } from "@/components/message-composer";
import { isMonth, MonthChips, monthCounts } from "@/components/month-chips";
import { AVAILABILITY_LABEL, AVAILABILITY_TONE, CHANNEL_SHORT, RELATION_LABEL, RELATION_TONE } from "@/lib/labels";
import {
  COOLDOWN_DAYS,
  getOpportunities,
  groupByPerformer,
  IGNORED_NOTE,
  NEAR_RADII,
  nearOpportunities,
  routeOpportunities,
  MAX_TRAVEL_MIN,
  NEW_FOR_DAYS,
  searchOpportunities,
  type Opportunity,
  type OpportunityGroup,
} from "@/lib/opportunities";
import { loadUpcomingEventsCached } from "@/lib/events-cache";
import { findPlace, placeName } from "@/lib/geo";
import { pitchMessage } from "@/lib/messages";
import { INTERVAL_LABEL } from "@/lib/recurring";
import { parseDays, ROUTE_CORRIDORS, ROUTE_MAX_DAYS } from "@/lib/route";
import { parseDateQuery } from "@/lib/time";
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

/** „↻ Cykliczne?”: oznacz rytm serii (albo że to nie seria) — apka dopisze przewidywane terminy. */
function RecurringMenu({ o }: { o: Opportunity }) {
  const button = "bg-card h-9 rounded-lg px-3 text-left text-[14px] active:scale-[0.98]";
  return (
    <details className="group/rec open:basis-full">
      <summary className="bg-secondary text-secondary-foreground flex h-9 w-fit cursor-pointer list-none items-center gap-1 rounded-lg px-3 text-[14px] [&::-webkit-details-marker]:hidden">
        <Repeat className="size-3.5" /> {o.series ? "Seria" : "Cykliczne?"}
        <ChevronDown className="size-3.5 transition-transform group-open/rec:rotate-180" />
      </summary>
      <div className="bg-muted mt-2 grid grid-cols-2 gap-1.5 rounded-xl p-2">
        {(Object.keys(INTERVAL_LABEL) as (keyof typeof INTERVAL_LABEL)[]).map((i) => (
          <form key={i} action={markRecurring.bind(null, o.event.id, i)}>
            <PendingButton className={cn(button, "w-full")}>{INTERVAL_LABEL[i]}</PendingButton>
          </form>
        ))}
        <form action={markRecurring.bind(null, o.event.id, "off")}>
          <PendingButton className={cn(button, "text-muted-foreground w-full")}>Nie jest cykliczne</PendingButton>
        </form>
        {o.series?.how === "manual" && (
          <form action={markRecurring.bind(null, o.event.id, "auto")}>
            <PendingButton className={cn(button, "text-muted-foreground w-full")}>Wykrywaj sam</PendingButton>
          </form>
        )}
        <p className="text-muted-foreground col-span-2 px-1 text-[12px]">
          Rytm liczę od tego terminu ({fmtDate(o.event.startsAt)}); przewidywane terminy pojawią się w Okazjach na 8 tygodni naprzód.
        </p>
      </div>
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
          {o.event.availability && (
            <Pill tone={AVAILABILITY_TONE[o.event.availability]}>{AVAILABILITY_LABEL[o.event.availability]}</Pill>
          )}
          {o.predicted && <Pill tone="muted">przewidywane</Pill>}
          {g.isNew && !o.predicted && <Pill tone="info">nowe</Pill>}
          {o.note && <Pill tone="muted">{o.note}</Pill>}
          {o.badge && <Pill tone="neutral">{o.badge}</Pill>}
          {o.distanceKm != null && <Pill tone="neutral">{o.distanceKm < 3 ? "na miejscu" : `~${o.distanceKm} km`}</Pill>}
          <ExternalLink className="text-muted-foreground/60 mt-1 size-3.5 shrink-0" />
        </div>
        <div className="text-muted-foreground mt-0.5 text-[13px]">{where(o)}</div>
        {o.series && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[12.5px]">
            <Repeat className="size-3" /> {o.series.text}
            {o.series.how === "auto" && " · wykryte"}
            {o.predicted && " · sprawdź u organizatora"}
          </div>
        )}
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
              {m.lastMessageAt && (
                <span className="text-muted-foreground whitespace-nowrap">
                  pisałeś {fmtDate(m.lastMessageAt)}
                  {m.lastMessageChannel && ` (${CHANNEL_SHORT[m.lastMessageChannel] ?? m.lastMessageChannel})`}
                  {m.lastMessageReplied ? " · odpisał" : " · bez odpowiedzi"}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <GigButton o={o} />
        <WriteMenu g={g} />
        {(o.isOpenMic || o.series) && <RecurringMenu o={o} />}
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
                  {x.event.availability && (
                    <span className={x.event.availability === "sold_out" ? "text-st-rej" : "text-st-wai"}>
                      {" "}
                      · {AVAILABILITY_LABEL[x.event.availability]}
                    </span>
                  )}
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

/** Szukaj komika (albo programu, miejsca) we wszystkich nadchodzących wydarzeniach. */
function SearchBox({ q }: { q: string }) {
  return (
    <form action="/events" className="bg-muted mb-3 flex h-10 items-center gap-2 rounded-xl px-3">
      <Search className="text-muted-foreground size-4 shrink-0" />
      <input
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Komik, miasto albo data, np. 14.10"
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[16px] outline-none"
      />
      {q && (
        <Link href="/events" aria-label="Wyczyść" className="text-muted-foreground -mr-1 p-1">
          <X className="size-4" />
        </Link>
      )}
    </form>
  );
}

type RouteParams = { from: string; to: string; date: string; days: number; corridor: number };

/** „Trasa”: jadę do [miasta] na [dzień] — grania po drodze przez N dni wcześniej. */
function RouteForm({ p, open }: { p: Partial<RouteParams> & { date: string }; open?: boolean }) {
  const field = "bg-card h-10 rounded-lg px-3 text-[15px] outline-none min-w-0";
  return (
    <details className="group/route mb-3" open={open}>
      <summary className="text-primary flex cursor-pointer list-none items-center gap-1.5 px-1 text-[14px] [&::-webkit-details-marker]:hidden">
        <Navigation className="size-4" /> Trasa — grania po drodze
        <ChevronDown className="size-3.5 transition-transform group-open/route:rotate-180" />
      </summary>
      <form action="/events" className="bg-muted mt-2 space-y-2 rounded-xl p-2">
        <input type="hidden" name="route" value="1" />
        {!open && (
          <input
            name="rt"
            placeholder="np. 30.10 Słupsk 3 dni"
            className={cn(field, "w-full")}
            aria-label="Opisz trasę jednym zdaniem"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <input name="from" defaultValue={p.from ?? "Warszawa"} placeholder="Skąd" className={field} aria-label="Skąd" />
          <input name="to" defaultValue={p.to} placeholder="Dokąd, np. Słupsk" className={field} aria-label="Dokąd" />
          <input name="d" type="date" defaultValue={p.date} className={field} aria-label="Muszę być na miejscu" />
          <select name="n" defaultValue={p.days ?? 2} className={field} aria-label="Ile dni drogi">
            {Array.from({ length: ROUTE_MAX_DAYS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {plural(n, "dzień", "dni", "dni")} drogi
              </option>
            ))}
          </select>
          <select name="w" defaultValue={p.corridor ?? 50} className={cn(field, "col-span-2")} aria-label="Jak daleko od trasy">
            {ROUTE_CORRIDORS.map((w) => (
              <option key={w} value={w}>
                do {w} km od trasy
              </option>
            ))}
          </select>
        </div>
        <p className="text-muted-foreground px-1 text-[12px]">Wpisz zdanie albo wypełnij pola — to, co rozpoznam w zdaniu, ma pierwszeństwo.</p>
        <button type="submit" className="bg-primary text-primary-foreground h-10 w-full rounded-lg text-[15px] font-medium active:scale-[0.98]">
          Pokaż trasę
        </button>
      </form>
    </details>
  );
}

async function RouteResults({ p }: { p: RouteParams }) {
  const r = await routeOpportunities(
    { from: p.from, to: p.to, arriveBy: p.date, days: p.days, corridorKm: p.corridor },
    loadUpcomingEventsCached,
  );
  const title = `${p.from} → ${p.to}`;
  return (
    <>
      <PageHeader
        title="Trasa"
        back={{ href: "/events", label: "Okazje" }}
        subtitle={`${title} · na ${fmtDate(p.date)} · ${plural(p.days, "dzień", "dni", "dni")} drogi${r.ok ? ` · ok. ${Math.round(r.totalKm)} km` : ""}`}
      />
      <RouteForm p={p} open />
      {!r.ok ? (
        <Section>
          <Empty>Nie znam miejscowości „{r.missing}” — wpisz pełną polską nazwę, np. Słupsk albo Bielsko-Biała.</Empty>
        </Section>
      ) : r.plan.length === 0 ? (
        <Section>
          <Empty>Te dni już minęły — wybierz późniejszą datę.</Empty>
        </Section>
      ) : (
        <>
          {r.plan.map((d) => {
            const busy = r.busy.filter((g) => g.startsAt.slice(0, 10) === d.day);
            const card = (o: (typeof d.alternatives)[number]): OpportunityGroup => ({
              performer: o.performer,
              primary: { ...o, badge: `${Math.round(o.offKm)} km od trasy` },
              others: [],
              matches: o.matches,
              isNew: o.isNew,
            });
            return (
              <Section
                key={d.day}
                title={
                  <span className="capitalize">
                    {fmtDate(d.day)} · ok. {Math.round(d.ideal * r.totalKm)} km od startu
                  </span>
                }
              >
                {busy.length > 0 ? (
                  busy.map((g) => (
                    <Link key={g.id} href={`/gigs/${g.id}`} className="block px-4 py-3 text-[15px]">
                      Masz już granie: <b className="font-semibold">{g.title}</b>
                      {g.cityName && <span className="text-muted-foreground"> · {g.cityName}</span>}
                    </Link>
                  ))
                ) : d.pick ? (
                  <>
                    <GroupCard g={card(d.pick)} />
                    {d.alternatives.length > 0 && (
                      <details className="group/alt border-t">
                        <summary className="text-primary flex cursor-pointer list-none items-center gap-1 px-4 py-2.5 text-[14px] [&::-webkit-details-marker]:hidden">
                          Inne tego dnia ({d.alternatives.length})
                          <ChevronDown className="size-3.5 transition-transform group-open/alt:rotate-180" />
                        </summary>
                        {d.alternatives.map((o) => (
                          <GroupCard key={o.id} g={card(o)} />
                        ))}
                      </details>
                    )}
                  </>
                ) : d.alternatives.length ? (
                  <>
                    <p className="text-muted-foreground px-4 pt-2.5 text-[12.5px]">
                      Nie pasuje do kolejności trasy (wymagałoby cofania), ale jest tego dnia:
                    </p>
                    {d.alternatives.map((o) => (
                      <GroupCard key={o.id} g={card(o)} />
                    ))}
                  </>
                ) : (
                  <Empty>Nic po drodze tego dnia — może dzień przerwy albo szerszy korytarz.</Empty>
                )}
              </Section>
            );
          })}
          <p className="text-muted-foreground -mt-4 mb-7 px-1 text-[12.5px] leading-relaxed">
            Propozycje są ułożone tak, żeby każdego dnia jechać dalej w stronę celu. Korytarz liczę od linii prostej start–cel —
            prawdziwa droga bywa inna (np. przez Trójmiasto), wtedy poszerz korytarz. Bez pomijanych i wyciszonych komików.
          </p>
        </>
      )}
    </>
  );
}

/** Z pola „30.10 Słupsk 3 dni” (albo pól formularza) robi parametry trasy. */
function routeParams(sp: Record<string, string | string[] | undefined>): RouteParams | null {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const today = nowLocal().slice(0, 10);
  const text = str("rt");
  const fromText = text ? findPlace(text, ["z", "ze"]) : null;
  const toText = text ? (findPlace(text, ["do", "ku"]) ?? findPlace(text)) : null;
  const dateText = text ? parseDateQuery(text, today).date : null;
  // Zdanie ma pierwszeństwo (pola formularza zawsze mają wartości domyślne), pola uzupełniają braki.
  const to = (toText ? placeName(toText) : "") || str("to");
  if (!to) return null;
  const d = str("d");
  return {
    from: (fromText ? placeName(fromText) : "") || str("from") || "Warszawa",
    to,
    date: dateText ?? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today),
    days: (text && /\d\s*(dni|dzie|doby)/i.test(text) ? parseDays(text) : Number(str("n"))) || 2,
    corridor: ROUTE_CORRIDORS.find((w) => String(w) === str("w")) ?? 50,
  };
}

/** „Jestem w [mieście] [dnia]” — co gra w okolicy, żeby dopisać się przy okazji wyjazdu. */
function NearForm({ near = "", date, radius = 60, span = false, cities }: { near?: string; date: string; radius?: number; span?: boolean; cities: string[] }) {
  const field = "bg-card h-10 rounded-lg px-3 text-[15px] outline-none";
  return (
    <details className="group/near mb-3" open={!!near}>
      <summary className="text-primary flex cursor-pointer list-none items-center gap-1.5 px-1 text-[14px] [&::-webkit-details-marker]:hidden">
        <MapPin className="size-4" /> Jestem w…
        <ChevronDown className="size-3.5 transition-transform group-open/near:rotate-180" />
      </summary>
      <form action="/events" className="bg-muted mt-2 grid grid-cols-2 gap-2 rounded-xl p-2">
        <input name="near" required defaultValue={near} list="near-cities" placeholder="Miasto, np. Kraków" className={cn(field, "col-span-2")} />
        <datalist id="near-cities">
          {cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input name="d" type="date" required defaultValue={date} className={field} />
        <select name="r" defaultValue={radius} className={field}>
          {NEAR_RADII.map((r) => (
            <option key={r} value={r}>
              do {r} km
            </option>
          ))}
        </select>
        <label className="col-span-2 flex items-center gap-2 px-1 text-[14px]">
          <input type="checkbox" name="span" value="1" defaultChecked={span} /> także dzień przed i po
        </label>
        <button type="submit" className="bg-primary text-primary-foreground col-span-2 h-10 rounded-lg text-[15px] font-medium active:scale-[0.98]">
          Pokaż okolicę
        </button>
      </form>
    </details>
  );
}

async function NearResults({ near, date, radius, span }: { near: string; date: string; radius: number; span: boolean }) {
  const [{ origin, items }, events] = await Promise.all([
    nearOpportunities(near, date, { radiusKm: radius, spanDays: span ? 1 : 0 }, loadUpcomingEventsCached),
    loadUpcomingEventsCached(nowLocal().slice(0, 10)),
  ]);
  const cities = [...new Set(events.map((e) => e.cityName).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "pl"));
  const card = (o: Opportunity): OpportunityGroup => ({ performer: o.performer, primary: o, others: [], matches: o.matches, isNew: o.isNew });
  const groups = items.filter((o) => o.note !== IGNORED_NOTE).map(card);
  const ignored = items.filter((o) => o.note === IGNORED_NOTE).map(card);
  const radiusHref = (r: number) => `/events?${new URLSearchParams({ near, d: date, r: String(r), ...(span ? { span: "1" } : {}) })}`;
  return (
    <>
      <PageHeader
        title="Okazje"
        back={{ href: "/events", label: "Okazje" }}
        subtitle={`W pobliżu: ${near} · ${fmtDate(date)}${span ? " ±1 dzień" : ""} · ${plural(groups.length, "termin", "terminy", "terminów")}`}
      />
      <NearForm near={near} date={date} radius={radius} span={span} cities={cities} />
      {origin ? (
        <>
          <div className="mb-3 flex gap-1.5">
            {NEAR_RADII.map((r) => (
              <Link
                key={r}
                href={radiusHref(r)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-medium",
                  r === radius ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                do {r} km
              </Link>
            ))}
          </div>
          <Section footer="Odległość w linii prostej od wpisanego miasta — drogą zwykle wychodzi ok. 1/3 więcej. Najbliższe najpierw.">
            {groups.length ? (
              groups.map((g) => <GroupCard key={g.primary.event.id} g={g} />)
            ) : (
              <Empty>Nic w tej okolicy tego dnia — spróbuj większego promienia albo ±1 dzień.</Empty>
            )}
          </Section>
          {ignored.length > 0 && (
            <Section title={`Pomijani komicy · ${ignored.length}`}>
              {ignored.map((g) => (
                <GroupCard key={g.primary.event.id} g={g} />
              ))}
            </Section>
          )}
        </>
      ) : (
        <Section>
          <Empty>Nie znam miejscowości „{near}” — wpisz pełną polską nazwę, np. Kraków albo Bielsko-Biała.</Empty>
        </Section>
      )}
    </>
  );
}

async function SearchResults({ q }: { q: string }) {
  const found = (await searchOpportunities(q, loadUpcomingEventsCached)).sort((a, b) =>
    a.event.startsAt.localeCompare(b.event.startsAt),
  );
  // Każdy termin osobno — szukam jego grań, więc nie chowam ich pod „Inne terminy”.
  const card = (o: Opportunity): OpportunityGroup => ({
    performer: o.performer,
    primary: o,
    others: [],
    matches: o.matches,
    isNew: o.isNew,
  });
  // Pomijani komicy (nie interesuje / nie robi open miców) osobno, pod głównymi wynikami.
  const groups = found.filter((o) => o.note !== IGNORED_NOTE).map(card);
  const ignored = found.filter((o) => o.note === IGNORED_NOTE).map(card);
  return (
    <>
      <PageHeader title="Okazje" subtitle={`„${q}” · ${plural(found.length, "termin", "terminy", "terminów")}`} />
      <SearchBox q={q} />
      <Section footer="Szukam po komiku, programie, scenie, mieście i dacie („14.10”, „14 paź”, „jutro”) we wszystkich nadchodzących wydarzeniach — także poza zasięgiem i u pomijanych; szara etykieta mówi, czemu normalnie ich nie widzisz.">
        {groups.length ? (
          groups.map((g) => <GroupCard key={g.primary.event.id} g={g} />)
        ) : (
          <Empty>{ignored.length ? "Nic poza pomijanymi komikami." : "Nic nie znalazłem."}</Empty>
        )}
      </Section>
      {ignored.length > 0 && (
        <Section
          title={`Pomijani komicy · ${ignored.length}`}
          footer="Komicy, których pomijasz w Okazjach (nie interesuje / nie robi open miców). Przywrócisz ich na karcie kontaktu."
        >
          {ignored.map((g) => (
            <GroupCard key={g.primary.event.id} g={g} />
          ))}
        </Section>
      )}
    </>
  );
}

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  if (q) return <SearchResults q={q} />;
  if (sp.route === "1") {
    const rp = routeParams(sp);
    if (rp) return <RouteResults p={rp} />;
  }
  const near = typeof sp.near === "string" ? sp.near.trim() : "";
  if (near) {
    const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : nowLocal().slice(0, 10);
    const r = NEAR_RADII.find((x) => String(x) === sp.r) ?? 60;
    return <NearResults near={near} date={d} radius={r} span={sp.span === "1"} />;
  }
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

      <SearchBox q="" />
      <RouteForm p={{ date: nowLocal().slice(0, 10) }} open={sp.route === "1"} />
      <NearForm date={nowLocal().slice(0, 10)} cities={[...new Set(everything.map((o) => o.event.cityName).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "pl"))} />

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
