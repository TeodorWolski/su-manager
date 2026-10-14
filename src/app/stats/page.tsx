import Link from "next/link";
import { Empty, PageHeader, Section, Stat } from "@/components/ios";
import type { GigContext, GigOutcome } from "@/db/schema";
import { GIG_CONTEXT_LABEL, GIG_OUTCOME_LABEL } from "@/lib/labels";
import { GigTotalsCard } from "@/components/gig-totals";
import { getGigTotals, getStats } from "@/lib/queries";
import { plural } from "@/lib/text";
import { monthName } from "@/components/goals";

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const rating = (n: number) => n.toFixed(1).replace(".", ",");

/** Wiersz z poziomym słupkiem (jedna seria, jeden kolor — etykieta i wartość w tekście). */
function BarRow({ label, share, value, sub, href }: { label: React.ReactNode; share: number; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px]">{label}</span>
        <span className="shrink-0 text-[14px] font-medium tabular-nums">{value}</span>
      </div>
      <div className="bg-foreground/6 mt-1.5 h-1.5 overflow-hidden rounded-full" title={`${typeof label === "string" ? label : ""}: ${value}${sub ? ` · ${sub}` : ""}`}>
        <div className="bg-foreground/70 h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, share * 100))}%` }} />
      </div>
      {sub && <div className="text-muted-foreground mt-1 text-[12px]">{sub}</div>}
    </>
  );
  const cls = "block px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/70";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-muted/50 transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function StatsPage() {
  const [s, totals] = await Promise.all([getStats(), getGigTotals()]);
  const decided = s.outcomes.reduce((sum, o) => sum + Number(o.n), 0);
  const count = (o: GigOutcome) => Number(s.outcomes.find((x) => x.outcome === o)?.n ?? 0);
  const maxOutcome = Math.max(1, ...s.outcomes.map((o) => Number(o.n)));
  const order: GigOutcome[] = ["agreed", "declined", "ghosted", "slot_taken", "no_openers"];

  return (
    <>
      <PageHeader title="Statystyki" back={{ href: "/more", label: "Więcej" }} />

      <GigTotalsCard t={totals} />

      <Section title="Pisanie do komików" footer="Wyniki zapisujesz na karcie grania („Jak się skończyło?”).">
        {decided ? (
          <>
            <div className="grid grid-cols-3 gap-2 p-2">
              <Stat label="Zgody" value={`${pct(count("agreed"), decided)}%`} />
              <Stat label="Odmowy" value={`${pct(count("declined") + count("no_openers"), decided)}%`} />
              <Stat label="Ghosting" value={`${pct(count("ghosted"), decided)}%`} />
            </div>
            {order
              .filter((o) => count(o) > 0)
              .map((o) => (
                <BarRow key={o} label={GIG_OUTCOME_LABEL[o]} share={count(o) / maxOutcome} value={String(count(o))} />
              ))}
          </>
        ) : (
          <Empty>Jeszcze żadnego wyniku — zaznacz „Jak się skończyło?” przy graniu.</Empty>
        )}
      </Section>

      <Section title="Który kanał działa" footer="Ile wiadomości w sprawie grań dostało odpowiedź (ghosting i brak odpowiedzi liczą się jako „nie”).">
        {s.channels.length ? (
          s.channels.map((c) => (
            <BarRow
              key={c.channel}
              label={c.channel}
              share={Number(c.replied) / Number(c.sent)}
              value={`${pct(Number(c.replied), Number(c.sent))}%`}
              sub={`${c.replied} z ${c.sent} odpisało`}
            />
          ))
        ) : (
          <Empty>Brak wiadomości zapisanych przy graniach.</Empty>
        )}
      </Section>

      <Section title="Jak mi idzie — wg kontekstu" footer="Średnia moja ocena z logów (1–5).">
        {s.byContext.length ? (
          s.byContext.map((c) => (
            <BarRow
              key={c.context ?? "none"}
              label={c.context ? GIG_CONTEXT_LABEL[c.context as GigContext] : "Bez kontekstu"}
              share={Number(c.avg) / 5}
              value={`★ ${rating(Number(c.avg))}`}
              sub={plural(Number(c.n), "granie", "grania", "grań")}
            />
          ))
        ) : (
          <Empty>Brak logów.</Empty>
        )}
      </Section>

      {s.byMonth.length > 0 && (
        <Section title="Miesiąc po miesiącu">
          {s.byMonth.map((m) => (
            <BarRow
              key={m.month}
              label={<span className="capitalize">{monthName(m.month, "LLLL yyyy")}</span>}
              share={Number(m.avg) / 5}
              value={`★ ${rating(Number(m.avg))}`}
              sub={plural(Number(m.n), "ocenione granie", "ocenione grania", "ocenionych grań")}
            />
          ))}
        </Section>
      )}

      {s.byVenue.length > 0 && (
        <Section title="Sceny" footer="Tylko sceny z co najmniej 2 ocenionymi graniami, od najlepiej mi idących.">
          {s.byVenue.map((v) => (
            <BarRow
              key={v.id}
              href={`/venues/${v.id}`}
              label={v.name}
              share={Number(v.avg) / 5}
              value={`★ ${rating(Number(v.avg))}`}
              sub={plural(Number(v.n), "granie", "grania", "grań")}
            />
          ))}
        </Section>
      )}
    </>
  );
}
