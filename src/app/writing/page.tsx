import { deleteWriting } from "@/app/actions";
import { PendingButton } from "@/components/form";
import { Empty, PageHeader, Section, Stat } from "@/components/ios";
import { getWriting } from "@/lib/planning";
import { listWriting } from "@/lib/queries";
import { plural } from "@/lib/text";
import { fmtDate } from "@/lib/time";
import { WRITING_LABEL } from "@/lib/writing";

/** Historia pisania z ostatnich 60 dni, pogrupowana po dniach; sesję da się usunąć. */
export default async function WritingPage() {
  const [sessions, w] = await Promise.all([listWriting(60), getWriting()]);
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const count = (k: string) => sessions.filter((s) => s.kind === k).length;
  return (
    <>
      <PageHeader title="Pisanie" back={{ href: "/more", label: "Więcej" }} subtitle="Ostatnie 60 dni" />
      <div className="mb-7 grid grid-cols-3 gap-2">
        <Stat label="Trening puent" value={count("punchlines")} />
        <Stat label="Generowanie" value={count("generate")} />
        <Stat label="Redakcja" value={count("edit")} />
      </div>
      <div className="mb-7 grid grid-cols-2 gap-2">
        <Stat label="Seria puent (rekord)" value={`${w.punchlines.streak} (${w.punchlines.best})`} />
        <Stat label="Poprawki, które siadły" value={w.fixed.length} />
      </div>
      {sessions.length ? (
        [...byDay.entries()].map(([day, list]) => (
          <Section key={day} title={<span className="capitalize">{fmtDate(day)}</span>}>
            {list.map((s) => (
              <div key={s.id} className="border-border/70 flex items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px]">
                    {WRITING_LABEL[s.kind]}
                    {s.bitName && <span className="text-muted-foreground"> · {s.bitName}</span>}
                  </div>
                  {(s.note || s.minutes) && (
                    <div className="text-muted-foreground truncate text-[13px]">
                      {[s.minutes && plural(s.minutes, "minuta", "minuty", "minut"), s.note].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <form action={deleteWriting.bind(null, s.id)}>
                  <PendingButton className="text-muted-foreground/60 hover:text-destructive px-1 text-lg" aria-label="Usuń sesję">
                    ×
                  </PendingButton>
                </form>
              </div>
            ))}
          </Section>
        ))
      ) : (
        <Section>
          <Empty>Jeszcze żadnej sesji — zacznij od treningu puent na ekranie Dziś.</Empty>
        </Section>
      )}
    </>
  );
}
