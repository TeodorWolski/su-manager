import { CalendarPlus, ChevronRight, Flame, History, Mic, Scale } from "lucide-react";
import Link from "next/link";
import type { Rhythm } from "@/lib/planning";
import { fmtDay, fmtRange, WEEK_MAX, WEEK_MIN, type Insight, type Week } from "@/lib/rhythm";
import { plural } from "@/lib/text";
import { cn } from "@/lib/utils";

const gigsWord = (n: number) => plural(n, "granie", "grania", "grań");

/** Słupek tygodnia: pełny = potwierdzone/zagrane, przygaszony = w toku. Kolor względem rytmu 2–3. */
function WeekBar({ w, max }: { w: Week; max: number }) {
  const total = w.confirmed + w.pending;
  const tone =
    w.confirmed > WEEK_MAX ? "bg-st-wai" : total >= WEEK_MIN ? "bg-st-ok" : w.when === "past" ? "bg-foreground/25" : "bg-st-int";
  const h = (n: number) => `${(n / max) * 100}%`;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className={cn("text-[11px] tabular-nums", w.when === "current" ? "font-semibold" : "text-muted-foreground")}>{total}</span>
      <div className="bg-foreground/6 relative flex h-12 w-full max-w-7 flex-col justify-end overflow-hidden rounded-[4px]">
        {/* pas 2–3 grań */}
        <div className="border-foreground/15 absolute inset-x-0 border-y border-dashed" style={{ bottom: h(WEEK_MIN), height: `${((WEEK_MAX - WEEK_MIN) / max) * 100}%` }} />
        {w.pending > 0 && <div className={cn(tone, "opacity-35")} style={{ height: h(w.pending) }} />}
        {w.confirmed > 0 && <div className={tone} style={{ height: h(w.confirmed) }} />}
      </div>
      <span className={cn("text-[10px] tabular-nums", w.when === "current" ? "text-foreground font-semibold" : "text-muted-foreground")}>
        {w.when === "current" ? "teraz" : `${Number(w.start.slice(8))}.${w.start.slice(5, 7)}`}
      </span>
    </div>
  );
}

function Line({ icon: Icon, tone, children }: { icon: typeof Flame; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 py-2 text-[14px] leading-snug">
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function InsightLine({ i }: { i: Insight }) {
  switch (i.kind) {
    case "streak":
      return (
        <Line icon={Flame} tone="text-st-wai">
          Planujesz <b className="font-semibold">{gigsWord(i.days)} dzień po dniu</b> ({fmtRange(i.from, i.to)})
          {i.withPending && ", licząc te w toku"}. Może któreś przesunąć, żeby rozłożyć je na tygodnie?
        </Line>
      );
    case "busy":
      return (
        <Line icon={Scale} tone="text-st-wai">
          {i.label}: <b className="font-semibold">{gigsWord(i.week.confirmed)}</b> — więcej niż {WEEK_MIN}–{WEEK_MAX}. Część mogłaby
          trafić na luźniejszy tydzień.
        </Line>
      );
    case "balance":
      return (
        <Line icon={Mic} tone="text-st-wai">
          {i.label}: <b className="font-semibold">{i.week.openers} przed komikami</b>
          {i.week.openMics ? `, ${i.week.openMics} open mic` : ", żadnego open mica"}. Może jedno zamienić na open mic? Najlepiej pół na
          pół, 2+1 w którąś stronę też jest OK.
        </Line>
      );
    case "add": {
      const have = i.week.confirmed + i.week.pending;
      return (
        <Line icon={CalendarPlus} tone="text-st-con">
          {i.label}{" "}
          {have === 0 ? "nic nie masz" : `masz ${gigsWord(have)}${i.week.pending ? ` (${i.week.pending} w toku)` : ""}`} — może warto
          dodać {have === 0 ? "dwa" : "jedno"}?
          {i.suggestions.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {i.suggestions.map((s) => (
                <Link
                  key={s.eventId}
                  href={s.href}
                  className="bg-muted/60 hover:bg-muted flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors"
                >
                  <span className="text-muted-foreground shrink-0 capitalize">{fmtDay(s.startsAt.slice(0, 10))}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {s.title}
                    {s.cityName && <span className="text-muted-foreground"> · {s.cityName}</span>}
                  </span>
                  <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Line>
      );
    }
    case "pastStreak":
      return (
        <Line icon={History} tone="text-muted-foreground">
          Ostatnio {gigsWord(i.days)} dzień po dniu ({fmtRange(i.from, i.to)}), a obok luźniej. Równiej, po {WEEK_MIN}–{WEEK_MAX} w
          tygodniu, będzie lżej.
        </Line>
      );
    case "uneven":
      return (
        <Line icon={History} tone="text-muted-foreground">
          Ostatnie tygodnie: {i.counts.join(" · ")} — dużo naraz, potem pusto.
        </Line>
      );
  }
}

/** Ekran Dziś: rytm grania w tygodniach (4 wstecz, bieżący, 3 naprzód) + podpowiedzi. Bez blokad. */
export function RhythmCard({ rhythm }: { rhythm: Rhythm }) {
  const { weeks, insights } = rhythm;
  const max = Math.max(WEEK_MAX + 1, ...weeks.map((w) => w.confirmed + w.pending));
  return (
    <section className="mb-7">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-muted-foreground text-[12.5px] font-medium">Rytm</h2>
        <span className="text-muted-foreground text-[12px]">
          cel {WEEK_MIN}–{WEEK_MAX} w tygodniu
        </span>
      </div>
      <div className="bg-card border-border rounded-[14px] border px-3.5 pt-3 pb-1.5">
        <div className="flex gap-1.5">
          {weeks.map((w) => (
            <WeekBar key={w.start} w={w} max={max} />
          ))}
        </div>
        <div className="border-border/70 mt-2.5 divide-border/70 divide-y border-t">
          {insights.length ? (
            insights.map((i, n) => <InsightLine key={n} i={i} />)
          ) : (
            <Line icon={Scale} tone="text-st-ok">
              Równy rytm — tak trzymaj.
            </Line>
          )}
        </div>
      </div>
    </section>
  );
}
