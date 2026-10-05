import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronRight, Flame, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { setMonthGoal } from "@/app/actions";
import { DEFAULT_MONTHLY_GIGS, type GoalsOverview } from "@/lib/goals";
import { plural } from "@/lib/text";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PendingButton } from "./form";

export const monthName = (month: string, pattern = "LLLL") => format(parseISO(`${month}-01`), pattern, { locale: pl });

/**
 * Pasek „segmentowy”: jeden segment = jedno granie. Wariant `ink` na ciemnej karcie celu
 * (limonka = zagrane, przygaszona limonka = zaplanowane), `paper` na jasnym tle (historia).
 * Ponad cel segmenty dochodzą po odstępie (bonus).
 */
export function GigPips({
  played,
  planned,
  target,
  variant = "paper",
  size = "lg",
}: {
  played: number;
  planned: number;
  target: number;
  variant?: "ink" | "paper";
  size?: "lg" | "sm";
}) {
  const total = Math.max(target, played + planned);
  const tone = {
    played: variant === "ink" ? "bg-lime" : "bg-st-ok",
    planned: variant === "ink" ? "bg-lime-dim" : "bg-st-ok/40",
    empty: variant === "ink" ? "bg-ink-card-track" : "bg-foreground/8",
  };
  return (
    <div className={cn("flex", size === "lg" ? "gap-0.75" : "gap-0.5")} role="img" aria-label={`${played} zagranych, ${planned} zaplanowanych, cel ${target}`}>
      {Array.from({ length: total }, (_, i) => {
        const state = i < played ? "played" : i < played + planned ? "planned" : "empty";
        return (
          <span
            key={i}
            title={`${i + 1}. ${state === "played" ? "zagrane" : state === "planned" ? "zaplanowane" : "brakuje"}`}
            className={cn("min-w-0 flex-1 rounded-[2px]", size === "lg" ? "h-2" : "h-1.5", i === target && "ml-1.5", tone[state])}
          />
        );
      })}
    </div>
  );
}

const QUICK_TARGETS = [6, 8, DEFAULT_MONTHLY_GIGS, 12, 15];

/** Cel miesiąca jako ciemna „karta” — jedyny mocny akcent na ekranie Dziś. */
export function GigGoalCard({ goals, link = true }: { goals: GoalsOverview; link?: boolean }) {
  const { month: g, streak } = goals;
  const left = g.target - g.played;
  const reached = g.played >= g.target;
  const status = reached
    ? g.target >= DEFAULT_MONTHLY_GIGS
      ? "super target zdobyty"
      : "cel zdobyty"
    : g.played + g.planned >= g.target
      ? `z zaplanowanymi domykasz cel`
      : g.played >= g.pace
        ? `przed tempem · brakuje ${left}`
        : `za tempem o ${Math.ceil(g.pace - g.played)}`;

  return (
    <div className="bg-ink-card text-ink-card-foreground rounded-[18px] p-[18px]">
      <div className="text-ink-card-muted flex items-center justify-between text-[12px]">
        <span className="capitalize">Grania · {monthName(g.month)}</span>
        {streak > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="size-3.5" /> seria {plural(streak, "miesiąc", "miesiące", "miesięcy")}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[52px] leading-none font-semibold tracking-[-0.04em]">{g.played}</span>
        <span className="text-ink-card-muted text-[17px] font-medium">
          / {g.target}
          {g.target === DEFAULT_MONTHLY_GIGS && " super target"}
        </span>
      </div>

      <div className="mt-3.5">
        <GigPips played={g.played} planned={g.planned} target={g.target} variant="ink" />
      </div>

      <div className="text-ink-card-muted mt-2.5 flex items-center justify-between gap-3 text-[12px]">
        <span>
          {g.played} zagrane · {plural(g.planned, "zaplanowane", "zaplanowane", "zaplanowanych")}
        </span>
        <b className={cn("font-semibold", reached ? "text-lime flex items-center gap-1" : "text-lime")}>
          {reached && <Trophy className="size-3.5" />}
          {status}
        </b>
      </div>

      {!g.isSet && (
        <div className="border-ink-card-track mt-4 border-t pt-3.5">
          <div className="text-[13px]">
            Ile grań w {monthName(g.month)}? <span className="text-ink-card-muted">10 to super target.</span>
          </div>
          <div className="mt-2.5 grid grid-cols-5 gap-1.5">
            {QUICK_TARGETS.map((n) => (
              <form key={n} action={setMonthGoal.bind(null, g.month, n)}>
                <PendingButton
                  className={cn(
                    "h-9 w-full rounded-lg text-[14px] font-semibold active:scale-95",
                    n === DEFAULT_MONTHLY_GIGS ? "bg-lime text-lime-foreground" : "bg-ink-card-track text-ink-card-foreground",
                  )}
                >
                  {n}
                </PendingButton>
              </form>
            ))}
          </div>
        </div>
      )}

      {link && (
        <Link href="/goals" className="text-ink-card-muted hover:text-ink-card-foreground mt-3.5 flex items-center text-[12.5px] transition-colors">
          Cele i historia <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

/** Mały kafelek (Dziś): materiał względem celu, z cienkim paskiem. */
export function MaterialTile({ goals }: { goals: GoalsOverview }) {
  const m = goals.material;
  const pct = Math.min(100, (m.tested / m.target) * 100);
  return (
    <Link href="/goals" className="bg-card border-border hover:bg-muted/40 block rounded-[14px] border p-3.5 transition-colors">
      <div className="text-muted-foreground text-[11.5px]">Materiał do {fmtDate(m.deadline).split(", ")[1] ?? fmtDate(m.deadline)}</div>
      <div className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">
        {m.tested} <span className="text-muted-foreground text-[14px] font-medium">/ {m.target} min</span>
      </div>
      <div className="bg-foreground/8 mt-2 h-1 overflow-hidden rounded-full">
        <div className="bg-st-ok h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

/** Mały kafelek (Dziś): średnia ocena grań w tym miesiącu. */
export function RatingTile({ avg, count }: { avg: number | null; count: number }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-3.5">
      <div className="text-muted-foreground text-[11.5px]">Średnia w tym miesiącu</div>
      <div className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{avg != null ? `★ ${avg.toFixed(1).replace(".", ",")}` : "—"}</div>
      <div className="text-muted-foreground mt-1.5 text-[11.5px]">{plural(count, "granie zagrane", "grania zagrane", "grań zagranych")}</div>
    </div>
  );
}

/** Pełna karta materiału (ekran Cele): sprawdzony + w testach wobec celu. */
export function MaterialGoalCard({ goals }: { goals: GoalsOverview }) {
  const m = goals.material;
  const pct = (v: number) => Math.min(100, (v / m.target) * 100);
  const testedPct = pct(m.tested);
  const testingPct = Math.min(100 - testedPct, pct(m.testing));
  const missing = Math.max(0, m.target - m.tested);
  const monthsLeft = Math.max(1, m.daysLeft / 30);

  return (
    <div className="bg-card border-border rounded-[14px] border p-4">
      <div className="text-muted-foreground text-[12px]">Materiał · cel do {fmtDate(m.deadline)}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[40px] leading-none font-semibold tracking-[-0.04em]">{m.tested}</span>
        <span className="text-muted-foreground text-[16px] font-medium">/ {m.target} min sprawdzonego</span>
        <span className="text-muted-foreground ml-auto text-[12px]">{plural(m.bits, "bit", "bity", "bitów")}</span>
      </div>

      <div
        className="bg-foreground/8 mt-3.5 flex h-2 overflow-hidden rounded-[2px]"
        role="img"
        aria-label={`${m.tested} min sprawdzonego i ${m.testing} min w testach z celu ${m.target} min`}
      >
        <span className="bg-st-ok h-full" style={{ width: `${testedPct}%` }} title={`sprawdzony: ${m.tested} min`} />
        {testingPct > 0 && (
          <span className="bg-st-wai/60 border-card h-full border-l-2" style={{ width: `${testingPct}%` }} title={`w testach: ${m.testing} min`} />
        )}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5"><span className="bg-st-ok size-2 rounded-[2px]" />sprawdzony {m.tested} min</span>
        <span className="flex items-center gap-1.5"><span className="bg-st-wai/60 size-2 rounded-[2px]" />w testach {m.testing} min</span>
        {m.vomit > 0 && <span className="flex items-center gap-1.5"><span className="bg-foreground/15 size-2 rounded-[2px]" />vomit {m.vomit} min</span>}
      </div>

      <div className={cn("mt-3 flex items-center gap-1.5 text-[13.5px]", missing === 0 && "text-st-ok font-semibold")}>
        {missing === 0 ? (
          <>
            <Trophy className="size-4 shrink-0" /> Cel osiągnięty. Czas podnieść poprzeczkę?
          </>
        ) : (
          <>
            <Target className="text-muted-foreground size-4 shrink-0" />
            Brakuje {missing} min · {plural(m.daysLeft, "dzień", "dni", "dni")} · ~{Math.ceil(missing / monthsLeft)} min/mies.
          </>
        )}
      </div>
    </div>
  );
}
