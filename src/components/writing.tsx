import { Check, ChevronDown, ExternalLink, Flame, PenLine, Target, Undo2 } from "lucide-react";
import Link from "next/link";
import { deleteWriting, logWriting } from "@/app/actions";
import type { Writing } from "@/lib/planning";
import { plural } from "@/lib/text";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { WRITING_HINT, WRITING_LABEL } from "@/lib/writing";
import { PendingButton, Select, SelectOrNew } from "./form";

const DAY_LETTERS = ["P", "W", "Ś", "C", "P", "S", "N"];

type BitOption = Writing["bitOptions"][number];

/**
 * Kafelek generowania / redakcji: x z celu w tym tygodniu + „+ sesja” z wyborem bitu.
 * Redakcja — bit obowiązkowy (kolejka do poprawki na górze), generowanie — bit opcjonalny albo nowy draft.
 */
function WeeklyTile({
  kind,
  done,
  target,
  streak,
  bits,
  queued,
}: {
  kind: "generate" | "edit";
  done: number;
  target: number;
  streak: number;
  bits: BitOption[];
  queued: Set<number>;
}) {
  const options = bits.map((b) => ({ value: b.id, label: queued.has(b.id) ? `⚠ ${b.name}` : b.name }));
  const hit = done >= target;
  return (
    <div className="bg-card border-border flex flex-col rounded-[14px] border p-3.5">
      <div className="text-muted-foreground text-[11.5px]">{WRITING_LABEL[kind]} · tydzień</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[20px] font-semibold tracking-[-0.02em]">{done}</span>
        <span className="text-muted-foreground text-[14px] font-medium">/ {target}</span>
        {hit && <Check className="text-st-ok size-4 self-center" />}
      </div>
      <div className="text-muted-foreground mt-0.5 min-h-4 text-[11.5px]">
        {streak > 1 ? `seria ${plural(streak, "tydzień", "tygodnie", "tygodni")}` : WRITING_HINT[kind]}
      </div>
      <details className="group/s mt-2.5">
        <summary className="bg-secondary text-secondary-foreground flex h-9 cursor-pointer list-none items-center justify-center gap-1 rounded-lg text-[14px] font-medium [&::-webkit-details-marker]:hidden">
          + sesja <ChevronDown className="size-3.5 transition-transform group-open/s:rotate-180" />
        </summary>
        <form action={logWriting} className="bg-muted mt-2 space-y-2 rounded-lg p-2">
          <input type="hidden" name="kind" value={kind} />
          <div className="bg-card rounded-md px-2 py-1.5">
            {kind === "edit" ? (
              <Select name="bitId" required placeholder="który bit?" options={options} className="text-left text-[14px]" />
            ) : (
              <SelectOrNew name="bitId" newName="newBitName" placeholder="bit (opcjonalnie)" newPlaceholder="nowy draft" options={options} />
            )}
          </div>
          <PendingButton className="bg-primary text-primary-foreground h-9 w-full rounded-lg text-[14px] font-semibold active:scale-95">
            Zapisz
          </PendingButton>
        </form>
      </details>
    </div>
  );
}

/**
 * Ekran Dziś: regularność pisania. Trening puent — codziennie (seria dni), generowanie i redakcja —
 * cel tygodniowy, plus kolejka bitów do poprawki po scenie. Samo pisanie dzieje się w Notion / Docs.
 */
export function WritingCard({ w, link = { href: "/writing", label: "Pisanie →" } }: { w: Writing; link?: { href: string; label: string } }) {
  const p = w.punchlines;
  const todayPunch = w.todaySessions.find((s) => s.kind === "punchlines");
  const queued = new Set(w.queue.map((q) => q.bitId));
  const recentFix = w.fixed.filter((f) => f.date.slice(0, 10) >= w.today.slice(0, 8) + "01").at(-1);
  return (
    <section className="mb-7">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-muted-foreground flex items-center gap-1 text-[12.5px] font-medium">
          <PenLine className="size-3.5" /> Pisanie
        </h2>
        <Link href={link.href} className="text-primary text-[13px]">
          {link.label}
        </Link>
      </div>

      <div className="bg-card border-border rounded-[14px] border p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-muted-foreground text-[11.5px]">{WRITING_LABEL.punchlines} · codziennie</div>
            <div className="mt-1 flex items-center gap-1.5 text-[20px] font-semibold tracking-[-0.02em]">
              <Flame className={cn("size-5", p.streak > 0 ? "text-st-wai" : "text-muted-foreground/50")} />
              {plural(p.streak, "dzień", "dni", "dni")}
            </div>
            <div className="text-muted-foreground mt-0.5 text-[11.5px]">
              {p.doneToday ? "dziś zrobione" : p.streak > 0 ? "dziś jeszcze nie — nie zrywaj serii" : "premisa + 10 puent"}
              {p.best > p.streak && ` · rekord ${p.best}`}
            </div>
          </div>
          <div className="flex gap-1" aria-label="Trening puent w tym tygodniu">
            {p.dots.map((d, i) => (
              <span
                key={d.day}
                title={fmtDate(d.day)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10.5px] font-semibold",
                  d.done ? "bg-st-ok text-white" : d.future ? "bg-foreground/5 text-muted-foreground/50" : "bg-foreground/8 text-muted-foreground",
                  d.today && !d.done && "ring-st-wai ring-2",
                )}
              >
                {DAY_LETTERS[i]}
              </span>
            ))}
          </div>
        </div>

        {todayPunch ? (
          <div className="bg-muted mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[14px]">
            <Check className="text-st-ok size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{todayPunch.note ? `Premisa: ${todayPunch.note}` : "Dziś 10 puent zrobione"}</span>
            <form action={deleteWriting.bind(null, todayPunch.id)}>
              <PendingButton className="text-muted-foreground flex items-center gap-1 text-[13px]" aria-label="Cofnij">
                <Undo2 className="size-3.5" /> cofnij
              </PendingButton>
            </form>
          </div>
        ) : (
          <form action={logWriting} className="mt-3 flex gap-2">
            <input type="hidden" name="kind" value="punchlines" />
            <input
              name="note"
              placeholder="Premisa (opcjonalnie)"
              className="bg-muted placeholder:text-muted-foreground/70 h-10 min-w-0 flex-1 rounded-lg px-3 text-[15px] outline-none"
            />
            <PendingButton className="bg-primary text-primary-foreground h-10 shrink-0 rounded-lg px-4 text-[15px] font-semibold active:scale-95">
              Zrobiłem
            </PendingButton>
          </form>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <WeeklyTile kind="generate" {...w.generate} bits={w.bitOptions} queued={queued} />
        <WeeklyTile kind="edit" {...w.edit} bits={w.bitOptions} queued={queued} />
      </div>

      {(w.queue.length > 0 || recentFix) && (
        <div className="bg-card border-border mt-2.5 rounded-[14px] border">
          {recentFix && (
            <div className="border-border/70 flex items-center gap-2 border-b px-3.5 py-2.5 text-[14px]">
              <Target className="text-st-ok size-4 shrink-0" /> Poprawka siadła: <b className="font-semibold">{recentFix.name}</b> 👍
            </div>
          )}
          {w.queue.length > 0 && (
            <details className="group/q" open={w.queue.length <= 3}>
              <summary className="text-muted-foreground flex cursor-pointer list-none items-center gap-1 px-3.5 py-2.5 text-[12.5px] font-medium [&::-webkit-details-marker]:hidden">
                Do poprawki po scenie · {w.queue.length}
                <ChevronDown className="size-3.5 transition-transform group-open/q:rotate-180" />
              </summary>
              {w.queue.map((q) => (
                <div key={q.bitId} className="border-border/70 flex items-center gap-2 border-t px-3.5 py-2">
                  <Link href={`/bits/${q.bitId}`} className="min-w-0 flex-1">
                    <div className="truncate text-[15px]">{q.name}</div>
                    <div className="text-muted-foreground text-[12px]">
                      {q.reaction < 0 ? "👎" : "😐"} {fmtDate(q.gigDate)}
                    </div>
                  </Link>
                  {q.docUrl && (
                    <a href={q.docUrl} target="_blank" rel="noreferrer" className="text-primary p-1" aria-label="Otwórz tekst">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  <form action={logWriting}>
                    <input type="hidden" name="kind" value="edit" />
                    <input type="hidden" name="bitId" value={q.bitId} />
                    <PendingButton className="bg-secondary text-secondary-foreground h-8 rounded-lg px-2.5 text-[13px] whitespace-nowrap active:scale-95">
                      Zredagowane
                    </PendingButton>
                  </form>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
