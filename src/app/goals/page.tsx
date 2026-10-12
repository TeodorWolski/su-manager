import { Check, Flame, Trophy } from "lucide-react";
import { saveMgmGoal, saveMonthGoal } from "@/app/actions";
import { NumberInput, SubmitButton } from "@/components/form";
import { GigGoalCard, GigPips, MgmCard, monthName } from "@/components/goals";
import { Empty, PageHeader, Section } from "@/components/ios";
import { DEFAULT_MONTHLY_GIGS, getGoals } from "@/lib/goals";
import { plural } from "@/lib/text";

export default async function GoalsPage() {
  const goals = await getGoals();
  const { month, history, streak, best, mgm } = goals;

  return (
    <>
      <PageHeader title="Cele" back={{ href: "/more", label: "Więcej" }} />

      <div className="mb-7 space-y-3">
        <GigGoalCard goals={goals} link={false} />
        <form action={saveMonthGoal} className="bg-card border-border flex items-center gap-3 rounded-[14px] border px-4 py-2">
          <input type="hidden" name="month" value={month.month} />
          <label className="flex flex-1 items-center gap-3">
            <span className="text-[16px]">
              Cel na <span className="capitalize">{monthName(month.month)}</span>
            </span>
            <NumberInput name="target" min={1} max={60} defaultValue={month.target} className="w-16" />
          </label>
          <SubmitButton className="h-9 w-auto px-4 text-[15px]">Zapisz</SubmitButton>
        </form>
        <p className="text-muted-foreground px-4 text-[13px]">
          {DEFAULT_MONTHLY_GIGS} grań w miesiącu to super target ⭐ — domyślny, dopóki nie ustawisz innego.
        </p>
      </div>

      <div className="mb-7 space-y-3">
        <MgmCard mgm={mgm} />
        <form action={saveMgmGoal} className="bg-card border-border flex items-center gap-3 rounded-[14px] border px-4 py-2">
          <input type="hidden" name="month" value={mgm.month} />
          <label className="flex flex-1 items-center gap-3">
            <span className="text-[16px]">
              MGM na {monthName(mgm.month)} (min sprawdzonego)
            </span>
            <NumberInput name="target" min={1} max={120} defaultValue={mgm.target} className="w-16" />
          </label>
          <SubmitButton className="h-9 w-auto px-4 text-[15px]">Zapisz</SubmitButton>
        </form>
        <p className="text-muted-foreground px-4 text-[13px]">
          MGM = minuty bitów założonych w miesiącu (długość z bitu). Do celu liczy się tylko sprawdzony (status „Sprawdzony”); niesprawdzony i suma są w rozpisce. Odrzucone się nie liczą.
        </p>
      </div>

      <Section
        title="Grania — poprzednie miesiące"
        footer={
          <span className="flex flex-wrap gap-x-3">
            {streak > 0 && (
              <span className="flex items-center gap-1">
                <Flame className="size-3.5" /> seria: {plural(streak, "miesiąc", "miesiące", "miesięcy")} z celem
              </span>
            )}
            {best && (
              <span className="flex items-center gap-1">
                <Trophy className="size-3.5" /> rekord: <span className="capitalize">{monthName(best.month, "LLLL yyyy")}</span> —{" "}
                {plural(best.played, "granie", "grania", "grań")}
              </span>
            )}
          </span>
        }
      >
        {history.length ? (
          history.map((h) => (
            <div key={h.month} className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b">
              <div className="mb-1.5 flex items-center justify-between text-[15px]">
                <span className="capitalize">{monthName(h.month, "LLLL yyyy")}</span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  {h.played} / {h.target}
                  {h.hit && <Check className="text-primary size-4" aria-label="cel osiągnięty" />}
                </span>
              </div>
              <GigPips played={h.played} planned={0} target={h.target} size="sm" />
            </div>
          ))
        ) : (
          <Empty>Historia pojawi się po pierwszym pełnym miesiącu.</Empty>
        )}
      </Section>
    </>
  );
}
