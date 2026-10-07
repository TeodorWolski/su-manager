import { ExternalLink, Lightbulb, X } from "lucide-react";
import Link from "next/link";
import { addIdea, ideaAsPremise, ideaToBit, setIdeaStatus } from "@/app/actions";
import { PendingButton } from "@/components/form";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { WritingCard } from "@/components/writing";
import { BIT_STATUS_LABEL, BIT_STATUS_TONE, REACTION_EMOJI } from "@/lib/labels";
import { getWriting } from "@/lib/planning";
import { listBitsInProgress, listIdeas } from "@/lib/queries";
import { fmtDate } from "@/lib/time";

/**
 * Zakładka Pisanie: pomysł na szybko, trening i sesje, pomysły do przejrzenia, bity w pracy.
 * Teksty żyją w Notion / Docs — tu regularność, powiązanie z bitami i raport do Claude.
 */
export default async function WritingPage() {
  const [w, ideas, inProgress] = await Promise.all([getWriting(), listIdeas(), listBitsInProgress()]);
  const queued = new Set(w.queue.map((q) => q.bitId));
  return (
    <>
      <PageHeader title="Pisanie" />

      <form action={addIdea} className="mb-7 flex gap-2">
        <div className="bg-card border-border flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3">
          <Lightbulb className="text-st-wai size-4 shrink-0" />
          <input
            name="text"
            required
            autoComplete="off"
            placeholder="Pomysł na szybko…"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </div>
        <PendingButton className="bg-primary text-primary-foreground h-11 shrink-0 rounded-xl px-4 text-[15px] font-semibold active:scale-95">
          Zapisz
        </PendingButton>
      </form>

      <WritingCard w={w} link={{ href: "/writing/history", label: "Historia" }} />

      <Section
        title={`Pomysły · ${ideas.length}`}
        footer="„Premisa” — robisz z niego dzisiejszy trening puent. „→ bit” — zakłada bit roboczy (Vomit) z całym tekstem w notatkach."
      >
        {ideas.length ? (
          ideas.map((i) => (
            <div key={i.id} className="border-border/70 px-4 py-2.5 [&:not(:last-child)]:border-b has-[[data-pending]]:opacity-50">
              <div className="text-[15px] leading-snug whitespace-pre-wrap">{i.text}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-muted-foreground mr-auto text-[12px]">{fmtDate(i.createdAt.slice(0, 10))}</span>
                <form action={ideaAsPremise.bind(null, i.id)}>
                  <PendingButton className="bg-secondary text-secondary-foreground h-8 rounded-lg px-2.5 text-[13px]">Premisa</PendingButton>
                </form>
                <form action={ideaToBit.bind(null, i.id)}>
                  <PendingButton className="bg-secondary text-secondary-foreground h-8 rounded-lg px-2.5 text-[13px]">→ bit</PendingButton>
                </form>
                <form action={setIdeaStatus.bind(null, i.id, "dropped")}>
                  <PendingButton className="text-muted-foreground/70 h-8 px-1.5" aria-label="Odrzuć pomysł">
                    <X className="size-4" />
                  </PendingButton>
                </form>
              </div>
            </div>
          ))
        ) : (
          <Empty>Pusto — zapisuj tu wszystko, co przyjdzie do głowy w ciągu dnia.</Empty>
        )}
      </Section>

      <Section
        title="Bity w pracy"
        action={
          <Link href="/bits" className="text-primary text-[13px]">
            Cały materiał
          </Link>
        }
        footer="⚠ = dostał 😐/👎 na scenie i czeka na redakcję. Sesję nad bitem zapiszesz w „+ sesja” wyżej."
      >
        {inProgress.length ? (
          inProgress.map((b) => (
            <div key={b.id} className="border-border/70 flex items-center gap-2 px-4 py-2.5 [&:not(:last-child)]:border-b">
              <Link href={`/bits/${b.id}`} className="min-w-0 flex-1">
                <div className="truncate text-[15px]">
                  {queued.has(b.id) && "⚠ "}
                  {b.name}
                </div>
                <div className="text-muted-foreground truncate text-[12px]">
                  {[
                    b.lengthMin && `${b.lengthMin} min`,
                    b.lastReaction != null && b.lastPlayed && `${REACTION_EMOJI[b.lastReaction]} ${fmtDate(b.lastPlayed)}`,
                    b.lastSession ? `praca ${fmtDate(b.lastSession)}` : "bez sesji",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
              <Pill tone={BIT_STATUS_TONE[b.status]}>{BIT_STATUS_LABEL[b.status]}</Pill>
              {b.docUrl && (
                <a href={b.docUrl} target="_blank" rel="noreferrer" className="text-primary p-1" aria-label="Otwórz tekst">
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          ))
        ) : (
          <Empty>Brak bitów w pracy — zamień pomysł w bit albo dodaj w Materiale.</Empty>
        )}
      </Section>
    </>
  );
}
