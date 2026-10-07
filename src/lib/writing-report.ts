import type { BitStatus, WritingKind } from "@/db/schema";
import { BIT_STATUS_LABEL, GIG_CONTEXT_LABEL, REACTION_EMOJI } from "./labels";
import { plural } from "./text";
import { WRITING_LABEL } from "./writing";

/**
 * Raport pracy nad materiałem do wklejenia w rozmowę z Claude (Markdown): kontekst + prośba na górze,
 * potem regularność, premisy, pomysły i bity w pracy z reakcjami i notatkami ze sceny.
 * Czysta funkcja — dane: getWritingReport w queries.ts.
 */
export type ReportData = {
  from: string;
  to: string;
  days: number;
  sessions: { date: string; kind: WritingKind; bitName: string | null; note: string | null }[];
  streak: number;
  best: number;
  ideas: { text: string; createdAt: string }[];
  bits: {
    name: string;
    status: BitStatus;
    lengthMin: number | null;
    docUrl: string | null;
    notes: string | null;
    queued: boolean;
    sessions: { date: string; kind: WritingKind }[];
    stage: {
      date: string;
      where: string | null;
      context: string | null;
      reaction: number | null;
      rating: number | null;
      thoughts: string | null;
    }[];
  }[];
};

const MAX_THOUGHTS = 500;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const d = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export function writingReport(r: ReportData) {
  const count = (k: WritingKind) => r.sessions.filter((s) => s.kind === k).length;
  const punchDays = new Set(r.sessions.filter((s) => s.kind === "punchlines").map((s) => s.date)).size;
  const premises = r.sessions.filter((s) => s.kind === "punchlines" && s.note);
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(
    `Jestem komikiem stand-upowym (Warszawa, gram open miki i otwieram przed innymi komikami). Poniżej raport z mojej pracy nad materiałem z ostatnich ${r.days} dni (${d(r.from)}–${d(r.to)}), wygenerowany z mojej aplikacji.`,
    "",
    "Pracuję na trzy sposoby: **trening puent** (premisa + 10 puent, cel: codziennie), **generowanie** (wypluwanie, zalążki, pierwszy draft) i **redakcja** (poprawki na podstawie nagrań i tego, co działo się na scenie). Teksty trzymam w Notion / Google Docs — linki są przy bitach.",
    "",
    "Pomóż mi:",
    "1. Ocenić regularność — gdzie odpuszczam i co realnie zmienić.",
    "2. Wskazać, które bity redagować najpierw i w jakim kierunku — na podstawie reakcji ze sceny i moich notatek po występach.",
    "3. Wybrać 2–3 pomysły lub premisy, które najbardziej warto rozwinąć, i podpowiedzieć kąty / puenty.",
    "4. Zaproponować konkretny plan na najbliższy tydzień (co pisać, co redagować, co przetestować na scenie).",
    "",
    "Jeśli nie masz dostępu do linków z tekstami, poproś mnie o wklejenie konkretnego bitu.",
    "",
    "## Regularność",
    `- Trening puent: ${punchDays}/${r.days} dni · obecna seria: ${r.streak} dni (rekord ${r.best})`,
    `- Generowanie: ${plural(count("generate"), "sesja", "sesje", "sesji")}`,
    `- Redakcja: ${plural(count("edit"), "sesja", "sesje", "sesji")}`,
  );

  if (premises.length) {
    push("", "## Premisy z treningu puent");
    for (const s of premises) push(`- ${d(s.date)}: ${s.note}`);
  }

  if (r.ideas.length) {
    push("", "## Pomysły zapisane na szybko (jeszcze nierozwinięte)");
    for (const i of r.ideas) push(`- ${d(i.createdAt.slice(0, 10))}: ${i.text.replace(/\n+/g, " / ")}`);
  }

  const other = r.sessions.filter((s) => s.kind !== "punchlines");
  if (other.length) {
    push("", "## Sesje generowania i redakcji");
    for (const s of other) push(`- ${d(s.date)} · ${WRITING_LABEL[s.kind]}${s.bitName ? ` · ${s.bitName}` : ""}${s.note ? ` — ${s.note}` : ""}`);
  }

  if (r.bits.length) {
    push("", "## Bity w pracy");
    for (const b of r.bits) {
      push(
        "",
        `### ${b.name}${b.queued ? " ⚠ czeka na redakcję po scenie" : ""}`,
        `- Status: ${BIT_STATUS_LABEL[b.status]}${b.lengthMin ? ` · ok. ${b.lengthMin} min` : ""}`,
      );
      if (b.docUrl) push(`- Tekst: ${b.docUrl}`);
      if (b.notes) push(`- Notatki: ${cut(b.notes.replace(/\n+/g, " / "), 300)}`);
      if (b.sessions.length) push(`- Praca: ${b.sessions.map((s) => `${d(s.date)} ${WRITING_LABEL[s.kind].toLowerCase()}`).join(", ")}`);
      if (b.stage.length) {
        push("- Na scenie:");
        for (const g of b.stage) {
          const meta = [
            g.where,
            g.context && GIG_CONTEXT_LABEL[g.context as keyof typeof GIG_CONTEXT_LABEL],
            g.reaction != null && `bit: ${REACTION_EMOJI[g.reaction]}`,
            g.rating != null && `cały występ: ${g.rating}/5`,
          ]
            .filter(Boolean)
            .join(", ");
          push(`  - ${d(g.date)} (${meta})${g.thoughts ? ` — notatka po występie: „${cut(g.thoughts.replace(/\n+/g, " / "), MAX_THOUGHTS)}”` : ""}`);
        }
      } else push("- Na scenie: jeszcze nie grany");
    }
  }

  return lines.join("\n");
}
