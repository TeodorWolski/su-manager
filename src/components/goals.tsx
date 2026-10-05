import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronRight, Flame, Mic, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { setMonthGoal } from "@/app/actions";
import { DEFAULT_MONTHLY_GIGS, type GoalsOverview } from "@/lib/goals";
import { plural } from "@/lib/text";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PendingButton } from "./form";

export const monthName = (month: string, pattern = "LLLL") => format(parseISO(`${month}-01`), pattern, { locale: pl });

const card = "bg-card rounded-2xl p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-none";

/**
 * Miernik „kropkowy”: jedna kropka = jedno granie. Pełna = zagrane, półprzezroczysta = zaplanowane,
 * tor tego samego koloru = brakuje. Ponad cel kropki dochodzą po odstępie (bonus).
 */
export function GigPips({ played, planned, target, size = "lg" }: { played: number; planned: number; target: number; size?: "lg" | "sm" }) {
  const total = Math.max(target, played + planned);
  return (
    <div className={cn("flex", size === "lg" ? "gap-[3px]" : "gap-[2px]")} role="img" aria-label={`${played} zagranych, ${planned} zaplanowanych, cel ${target}`}>
      {Array.from({ length: total }, (_, i) => {
        const state = i < played ? "played" : i < played + planned ? "planned" : "empty";
        return (
          <span
            key={i}
            title={`${i + 1}. ${state === "played" ? "zagrane" : state === "planned" ? "zaplanowane" : "brakuje"}`}
            className={cn(
              "min-w-0 flex-1 rounded-full transition-colors",
              size === "lg" ? "h-3" : "h-1.5",
              i === target && "ml-1.5", // bonus ponad cel
              state === "played" ? "bg-primary" : state === "planned" ? "bg-primary/40 dark:bg-primary/55" : "bg-primary/12",
            )}
          />
        );
      })}
    </div>
  );
}

function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", i.className)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const QUICK_TARGETS = [6, 8, DEFAULT_MONTHLY_GIGS, 12, 15];

export function GigGoalCard({ goals, avgRating, link = true }: { goals: GoalsOverview; avgRating?: number | null; link?: boolean }) {
  const { month: g, streak } = goals;
  const left = g.target - g.played;
  const status =
    g.played >= g.target
      ? { icon: Trophy, text: g.target >= DEFAULT_MONTHLY_GIGS ? "Super target zdobyty!" : "Cel zdobyty!", strong: true }
      : g.played + g.planned >= g.target
        ? { icon: Target, text: `Z zaplanowanymi domykasz cel — zostało ${plural(left, "granie", "grania", "grań")} do zagrania`, strong: false }
        : g.played >= g.pace
          ? { icon: Target, text: `Przed tempem · brakuje ${plural(left, "granie", "grania", "grań")}`, strong: false }
          : {
              icon: Target,
              text: `Za tempem o ${Math.ceil(g.pace - g.played)} · ${plural(g.daysLeft, "dzień", "dni", "dni")} do końca miesiąca`,
              strong: false,
            };
  const Icon = status.icon;

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-[13px] font-medium">
          <Mic className="size-3.5" />
          <span className="capitalize">Grania · {monthName(g.month)}</span>
        </span>
        {streak > 0 && (
          <span className="bg-warning/15 flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold text-amber-700 dark:text-warning">
            <Flame className="size-3.5" /> seria {plural(streak, "miesiąc", "miesiące", "miesięcy")}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[44px] leading-none font-bold tracking-tight">{g.played}</span>
        <span className="text-muted-foreground text-[20px] font-semibold">/ {g.target}</span>
        {g.target === DEFAULT_MONTHLY_GIGS && <span className="text-[13px]">⭐ super target</span>}
        {avgRating != null && <span className="text-primary ml-auto text-[15px] font-semibold">★ {avgRating.toFixed(1)}</span>}
      </div>

      <div className="mt-3">
        <GigPips played={g.played} planned={g.planned} target={g.target} />
        <Legend
          items={[
            { label: `zagrane ${g.played}`, className: "bg-primary" },
            { label: `zaplanowane ${g.planned}`, className: "bg-primary/40 dark:bg-primary/55" },
            { label: `brakuje ${Math.max(0, g.target - g.played - g.planned)}`, className: "bg-primary/12" },
          ]}
        />
      </div>

      <div className={cn("mt-3 flex items-center gap-1.5 text-[14px]", status.strong ? "text-primary font-semibold" : "text-foreground")}>
        <Icon className="size-4 shrink-0" />
        {status.text}
      </div>

      {!g.isSet && (
        <div className="bg-muted/60 mt-3 rounded-xl p-3">
          <div className="text-[14px] font-medium">
            Ile grań w {monthName(g.month, "LLLL")}? <span className="text-muted-foreground font-normal">10 to super target.</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {QUICK_TARGETS.map((n) => (
              <form key={n} action={setMonthGoal.bind(null, g.month, n)}>
                <PendingButton
                  className={cn(
                    "h-10 w-full rounded-lg text-[15px] font-semibold active:scale-95",
                    n === DEFAULT_MONTHLY_GIGS ? "bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  {n}
                  {n === DEFAULT_MONTHLY_GIGS && "⭐"}
                </PendingButton>
              </form>
            ))}
          </div>
        </div>
      )}

      {link && (
        <Link href="/goals" className="text-primary mt-3 flex items-center text-[14px]">
          Cele i historia <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function MaterialGoalCard({ goals, link = true }: { goals: GoalsOverview; link?: boolean }) {
  const m = goals.material;
  const pct = (v: number) => Math.min(100, (v / m.target) * 100);
  const testedPct = pct(m.tested);
  const testingPct = Math.min(100 - testedPct, pct(m.testing));
  const missing = Math.max(0, m.target - m.tested);
  const monthsLeft = Math.max(1, m.daysLeft / 30);

  return (
    <div className={card}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-[13px] font-medium">
        <Target className="size-3.5" />
        Materiał · cel do {fmtDate(m.deadline)}
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[44px] leading-none font-bold tracking-tight">{m.tested}</span>
        <span className="text-muted-foreground text-[20px] font-semibold">/ {m.target} min</span>
        <span className="text-muted-foreground ml-auto text-[13px]">{plural(m.bits, "bit", "bity", "bitów")}</span>
      </div>

      <div className="mt-3">
        <div
          className="bg-primary/12 relative flex h-3 overflow-hidden rounded-full"
          role="img"
          aria-label={`${m.tested} min sprawdzonego i ${m.testing} min w testach z celu ${m.target} min`}
        >
          <span className="bg-primary h-full rounded-full" style={{ width: `${testedPct}%` }} title={`sprawdzony: ${m.tested} min`} />
          {testingPct > 0 && (
            <span
              className="bg-primary/40 dark:bg-primary/55 border-card h-full rounded-r-full border-l-2"
              style={{ width: `${testingPct}%` }}
              title={`w testach: ${m.testing} min`}
            />
          )}
        </div>
        <Legend
          items={[
            { label: `sprawdzony ${m.tested} min`, className: "bg-primary" },
            { label: `w testach ${m.testing} min`, className: "bg-primary/40 dark:bg-primary/55" },
            ...(m.vomit ? [{ label: `vomit ${m.vomit} min`, className: "bg-primary/12" }] : []),
          ]}
        />
      </div>

      <div className={cn("mt-3 flex items-center gap-1.5 text-[14px]", missing === 0 && "text-primary font-semibold")}>
        {missing === 0 ? (
          <>
            <Trophy className="size-4 shrink-0" /> Cel osiągnięty — czas podnieść poprzeczkę?
          </>
        ) : (
          <>
            <Target className="size-4 shrink-0" />
            Brakuje {missing} min · {plural(m.daysLeft, "dzień", "dni", "dni")} · ~{Math.ceil(missing / monthsLeft)} min/mies.
          </>
        )}
      </div>

      {link && (
        <Link href="/goals" className="text-primary mt-3 flex items-center text-[14px]">
          Zmień cel <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
