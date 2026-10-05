import { Check, Flame, Trophy } from "lucide-react";
import { saveMaterialGoal, saveMonthGoal } from "@/app/actions";
import { FieldRow, NumberInput, SubmitButton, TextInput } from "@/components/form";
import { GigGoalCard, GigPips, MaterialGoalCard, monthName } from "@/components/goals";
import { Empty, PageHeader, Section } from "@/components/ios";
import { DEFAULT_MONTHLY_GIGS, getGoals } from "@/lib/goals";
import { plural } from "@/lib/text";

export default async function GoalsPage() {
  const goals = await getGoals();
  const { month, history, streak, best, material } = goals;

  return (
    <>
      <PageHeader title="Cele" back={{ href: "/more", label: "Więcej" }} />

      <div className="mb-7 space-y-3">
        <GigGoalCard goals={goals} link={false} />
        <form action={saveMonthGoal} className="bg-card flex items-center gap-3 rounded-2xl px-4 py-2">
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
        <MaterialGoalCard goals={goals} link={false} />
        <form action={saveMaterialGoal}>
          <Section footer="Liczy się sprawdzony materiał (status bitu „Sprawdzony” i jego długość). Domyślnie 15 min do końca roku.">
            <FieldRow label="Cel (min)">
              <NumberInput name="target" min={1} defaultValue={material.target} />
            </FieldRow>
            <FieldRow label="Do kiedy">
              <TextInput name="deadline" type="date" required defaultValue={material.deadline} />
            </FieldRow>
            <div className="px-4 py-2.5">
              <SubmitButton className="h-10">Zapisz cel materiału</SubmitButton>
            </div>
          </Section>
        </form>
      </div>

      <Section
        title="Poprzednie miesiące"
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
