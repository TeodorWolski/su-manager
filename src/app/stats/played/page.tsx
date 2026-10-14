import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { monthName } from "@/components/goals";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Section } from "@/components/ios";
import { playedGroups, totalKind, TOTAL_KINDS, type PlayedGroupBy, type TotalKind } from "@/lib/gig-totals";
import { GIG_CONTEXT_LABEL } from "@/lib/labels";
import { getPlayedGigs, type GigListItem } from "@/lib/queries";
import { plural } from "@/lib/text";

const KIND_TITLE: Record<TotalKind, string> = { ...GIG_CONTEXT_LABEL, other: "Inne i bez typu" };
const GROUP_TITLE: Record<PlayedGroupBy, string> = { cities: "Miasta", venues: "Sceny", headliners: "Komicy, przed którymi grałem" };
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Występy pogrupowane po miesiącach (najnowsze najpierw). */
function ByMonth({ gigs }: { gigs: GigListItem[] }) {
  if (!gigs.length) return <Section><Empty>Brak występów.</Empty></Section>;
  const months = new Map<string, GigListItem[]>();
  for (const g of gigs) months.set(g.startsAt.slice(0, 7), [...(months.get(g.startsAt.slice(0, 7)) ?? []), g]);
  return [...months].map(([m, list]) => (
    <Section key={m} title={<span className="capitalize">{`${monthName(m, "LLLL yyyy")} · ${list.length}`}</span>}>
      {list.map((g) => (
        <GigRow key={g.id} gig={g} />
      ))}
    </Section>
  ));
}

/**
 * Lista z licznika występów (Statystyki): ?k=typ, ?by=cities|venues|headliners (lista z liczbą),
 * ?city= / ?venue= / ?headliner= (występy w danym mieście, na scenie, przed komikiem).
 */
export default async function PlayedPage({ searchParams }: PageProps<"/stats/played">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const [k, by, city, venue, headliner] = [one(q.k), one(q.by), one(q.city), one(q.venue), one(q.headliner)];
  const played = await getPlayedGigs();
  const back = { href: "/stats", label: "Statystyki" };

  if (by === "cities" || by === "venues" || by === "headliners") {
    const groups = playedGroups(played, by);
    const param = { cities: "city", venues: "venue", headliners: "headliner" }[by];
    return (
      <>
        <PageHeader title={GROUP_TITLE[by]} subtitle={`${groups.length} · od najczęstszych`} back={back} />
        <Section>
          {groups.length ? (
            groups.map((g) => (
              <Link
                key={g.key}
                href={`/stats/played?${param}=${encodeURIComponent(g.key)}`}
                className="border-border/70 hover:bg-muted/50 flex items-center gap-3 px-4 py-2.5 transition-colors [&:not(:last-child)]:border-b"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{g.name}</div>
                  <div className="text-muted-foreground text-[12px]">ostatnio {dmy(g.last)}</div>
                </div>
                <span className="text-[15px] font-semibold tabular-nums">{g.count}×</span>
                <ChevronRight className="text-muted-foreground/60 size-4" />
              </Link>
            ))
          ) : (
            <Empty>Pusto.</Empty>
          )}
        </Section>
      </>
    );
  }

  let title = "Wszystkie występy";
  let list = played;
  let action: React.ReactNode = null;
  if (k && (TOTAL_KINDS as readonly string[]).includes(k)) {
    title = KIND_TITLE[k as TotalKind];
    list = played.filter((g) => totalKind(g.context) === k);
  } else if (city) {
    list = played.filter((g) => g.cityName?.toLowerCase() === city.toLowerCase());
    title = list[0]?.cityName ?? city;
  } else if (venue) {
    list = played.filter((g) => String(g.venueId) === venue);
    title = list[0]?.venueName ?? "Scena";
    action = <Link href={`/venues/${venue}`} className="text-primary text-[17px]">Scena</Link>;
  } else if (headliner) {
    list = played.filter((g) => String(g.headlinerId) === headliner && (g.context === "opener" || g.context === "support"));
    title = list[0]?.headlinerName ? `Przed: ${list[0].headlinerName}` : "Komik";
    action = <Link href={`/contacts/${headliner}`} className="text-primary text-[17px]">Kontakt</Link>;
  }

  return (
    <>
      <PageHeader title={title} subtitle={plural(list.length, "występ", "występy", "występów")} back={back} action={action} />
      <ByMonth gigs={list} />
    </>
  );
}
