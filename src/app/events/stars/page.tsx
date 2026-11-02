import Link from "next/link";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { announceLabel } from "@/lib/market";
import { loadHeadlinerRanking } from "@/lib/market-data";
import { fmtDate } from "@/lib/time";

/** Ile pozycji rankingu pokazujemy (reszta to ogon pojedynczych terminów). */
const SHOW = 30;

/**
 * „Kto sprzedaje sale” — komicy z bileterii, przed którymi warto zagrać: popyt (sold out / ostatnie bilety),
 * skala trasy, terminy w zasięgu, czy już przed nim grałem i kiedy zwykle wrzuca terminy. Logika: src/lib/market.ts.
 */
export default async function StarsPage() {
  const ranking = (await loadHeadlinerRanking()).slice(0, SHOW);
  return (
    <>
      <PageHeader title="Kto sprzedaje sale" subtitle="przed kim warto zagrać" back={{ href: "/events", label: "Okazje" }} />
      <Section
        footer="Z wszystkich wydarzeń zebranych z bileterii (też minionych). Popyt = terminy sold out i „ostatnie bilety”. „Wrzuca terminy” = ile przed występem pojawiają się w bileterii — tyle masz, żeby napisać, zanim zajmą sloty; „ponad 3 mies.” = wcześniej, niż sięga scraper."
      >
        {ranking.length ? (
          ranking.map((h, i) => (
            <Link
              key={h.key}
              href={h.contactId ? `/contacts/${h.contactId}` : `/events?q=${encodeURIComponent(h.name)}`}
              className="border-border/70 hover:bg-muted/50 flex gap-3 px-4 py-3 transition-colors [&:not(:last-child)]:border-b"
            >
              <span className="text-muted-foreground w-5 shrink-0 pt-0.5 text-right text-[13px] tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15.5px] font-medium">{h.name}</span>
                  {h.playedBefore ? <Pill tone="success">grałeś przed nim</Pill> : h.contactId ? <Pill tone="info">w CRM</Pill> : null}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[12.5px]">
                  {[
                    `${h.total} terminów`,
                    h.soldOut && `${h.soldOut}× sold out`,
                    h.last && `${h.last}× ostatnie bilety`,
                    h.cities > 1 && `${h.cities} miast`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="mt-0.5 text-[12.5px]">
                  {h.nextInRange ? (
                    <span>
                      w zasięgu: {h.inRange} · najbliżej {fmtDate(h.nextInRange.startsAt.slice(0, 10))}
                      {h.nextInRange.cityName && ` ${h.nextInRange.cityName}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">nic w zasięgu w najbliższych 3 mies.</span>
                  )}
                  {h.announce && <span className="text-muted-foreground"> · wrzuca terminy {announceLabel(h.announce)} przed</span>}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <Empty>Za mało wydarzeń z bileterii — scraper musi pozbierać więcej.</Empty>
        )}
      </Section>
    </>
  );
}
