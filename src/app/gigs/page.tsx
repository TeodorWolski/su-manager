import { Plus } from "lucide-react";
import Link from "next/link";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Rating, Section, Stat } from "@/components/ios";
import { isMonth, MonthChips, monthCounts } from "@/components/month-chips";
import { Button } from "@/components/ui/button";
import { listGigs } from "@/lib/queries";
import { plural } from "@/lib/text";
import { nowLocal } from "@/lib/time";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";

const VIEWS = {
  upcoming: "Nadchodzące",
  pipeline: "W toku",
  past: "Zagrane",
  all: "Wszystkie",
} as const;
type View = keyof typeof VIEWS;

const monthTitle = (month: string) => format(parseISO(`${month}-01`), "LLLL yyyy", { locale: pl });

export default async function GigsPage({ searchParams }: PageProps<"/gigs">) {
  const { view: raw, m } = await searchParams;
  const view: View = typeof raw === "string" && raw in VIEWS ? (raw as View) : "upcoming";
  const month = isMonth(m) ? m : null;
  const everything = await listGigs(view);
  const newestFirst = view === "past" || view === "all";
  const months = monthCounts(everything, (g) => g.startsAt, newestFirst ? "desc" : "asc");
  const items = month ? everything.filter((g) => g.startsAt.startsWith(month)) : everything;
  const href = (v: View, mm: string | null) => {
    const p = new URLSearchParams({ ...(v !== "upcoming" ? { view: v } : {}), ...(mm ? { m: mm } : {}) });
    return `/gigs${p.size ? `?${p}` : ""}`;
  };

  // Podsumowanie wybranego miesiąca w „Zagranych”: ile grań, średnia ocena.
  const rated = items.filter((g) => g.rating != null);
  const avg = rated.length ? rated.reduce((sum, g) => sum + g.rating!, 0) / rated.length : null;

  return (
    <>
      <PageHeader
        title="Grania"
        action={
          <Button asChild size="icon-lg" className="rounded-full">
            <Link href="/gigs/new" aria-label="Nowe granie">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      <div className="bg-muted mb-3 grid grid-cols-4 gap-1 rounded-xl p-1">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={href(v, null)}
            className={cn(
              "flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-all sm:text-[14px]",
              v === view ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </div>
      <MonthChips months={months} active={month} href={(mm) => href(view, mm)} thisYear={nowLocal().slice(0, 4)} />

      {month && view === "past" && items.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <Stat label={<span className="capitalize">{monthTitle(month)}</span>} value={plural(items.length, "granie", "grania", "grań")} />
          <Stat label={`Średnia · ${plural(rated.length, "ocenione", "ocenione", "ocenionych")}`} value={avg ? <Rating value={avg} /> : "—"} />
        </div>
      )}

      {items.length === 0 ? (
        <Section>
          <Empty>Nic tu jeszcze nie ma.</Empty>
        </Section>
      ) : month || months.length < 2 ? (
        <Section>
          {items.map((g) => (
            <GigRow key={g.id} gig={g} showStatus={view === "pipeline" || view === "all"} />
          ))}
        </Section>
      ) : (
        months.map(({ month: mm, count }) => (
          <Section key={mm} title={<span className="capitalize">{`${monthTitle(mm)} · ${count}`}</span>}>
            {items
              .filter((g) => g.startsAt.startsWith(mm))
              .map((g) => (
                <GigRow key={g.id} gig={g} showStatus={view === "pipeline" || view === "all"} />
              ))}
          </Section>
        ))
      )}
    </>
  );
}
