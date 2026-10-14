import { TOTAL_KINDS, type GigTotals, type TotalKind } from "@/lib/gig-totals";
import { plural } from "@/lib/text";

/** Te same kolory co w mini kalendarzu (tokeny --ctx-*); „Inne” szare. Podpisy zawsze obok koloru. */
const KIND: Record<TotalKind, { label: string; color: string }> = {
  open_mic: { label: "Open mic", color: "bg-ctx-openmic" },
  opener: { label: "Przed kimś", color: "bg-ctx-opener" },
  support: { label: "Support", color: "bg-ctx-support" },
  headline: { label: "Headline", color: "bg-ctx-headline" },
  other: { label: "Inne", color: "bg-st-int" },
};

/** Licznik występów od początku z podziałem na typ grania. */
export function GigTotalsCard({ t }: { t: GigTotals }) {
  const kinds = TOTAL_KINDS.filter((k) => t.byKind[k] > 0);
  const pct = (n: number) => Math.round((n / t.total) * 100);
  return (
    <div className="bg-card border-border mb-7 rounded-[14px] border p-4">
      <div className="text-muted-foreground flex items-baseline justify-between text-[12px]">
        <span>Występy łącznie</span>
        {t.first && <span>od {`${t.first.slice(8, 10)}.${t.first.slice(5, 7)}.${t.first.slice(0, 4)}`}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[40px] leading-none font-semibold tracking-[-0.04em]">{t.total}</span>
        <span className="text-muted-foreground text-[15px]">
          {plural(t.total, "występ", "występy", "występów").replace(/^\d+ /, "")} · w tym roku {t.thisYear}
        </span>
      </div>

      {t.total > 0 && (
        <>
          <div
            className="mt-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-[3px]"
            role="img"
            aria-label={kinds.map((k) => `${KIND[k].label}: ${t.byKind[k]}`).join(", ")}
          >
            {kinds.map((k) => (
              <div key={k} className={KIND[k].color} style={{ width: `${(t.byKind[k] / t.total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {kinds.map((k) => (
              <div key={k} className="flex items-center gap-2 text-[15px]">
                <span className={`${KIND[k].color} size-2.5 shrink-0 rounded-[3px]`} aria-hidden />
                <span className="flex-1">
                  {KIND[k].label}
                  {k === "other" && t.noContext > 0 && (
                    <span className="text-muted-foreground text-[12px]"> · {t.noContext} bez typu</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{t.byKind[k]}</span>
                <span className="text-muted-foreground w-10 text-right text-[13px] tabular-nums">{pct(t.byKind[k])}%</span>
              </div>
            ))}
          </div>
          <div className="border-border/70 mt-3.5 grid grid-cols-3 gap-2 border-t pt-3 text-center">
            {[
              [t.cities, plural(t.cities, "miasto", "miasta", "miast")],
              [t.venues, plural(t.venues, "scena", "sceny", "scen")],
              [t.headliners, t.headliners === 1 ? "komik, przed którym grałem" : "komików, przed którymi grałem"],
            ].map(([n, label]) => (
              <div key={String(label)}>
                <div className="text-[18px] font-semibold tabular-nums">{n}</div>
                <div className="text-muted-foreground text-[11.5px] leading-tight">{String(label).replace(/^\d+ /, "")}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
