import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBit, markBitTested } from "@/app/actions";
import { ConfirmButton, PendingButton } from "@/components/form";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Pill, Section, Stat } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { readyBits, READY_THUMBS } from "@/lib/bit-ready";
import { BIT_STATUS_LABEL, BIT_STATUS_TONE, REACTIONS } from "@/lib/labels";
import { getBit } from "@/lib/queries";
import { fmtDate, nowLocal } from "@/lib/time";
import { WRITING_LABEL } from "@/lib/writing";

export default async function BitPage({ params }: PageProps<"/bits/[id]">) {
  const { id } = await params;
  const data = await getBit(Number(id));
  if (!data) notFound();
  const { bit, gigs } = data;
  const rated = gigs.filter((g) => g.rating != null);
  const count = (r: number) => gigs.filter((g) => g.reaction === r).length;
  const [ready] = readyBits(
    [bit],
    gigs.map((g) => ({ bitId: bit.id, gigId: g.id, startsAt: g.startsAt, reaction: g.reaction })),
    nowLocal().slice(0, 7),
  );

  return (
    <>
      <PageHeader
        title={bit.name}
        subtitle={
          <span className="flex items-center gap-2">
            <Pill tone={BIT_STATUS_TONE[bit.status]}>{BIT_STATUS_LABEL[bit.status]}</Pill>
            {bit.lengthMin && `${bit.lengthMin} min`}
          </span>
        }
        back={{ href: "/bits", label: "Materiał" }}
        action={
          <Button asChild variant="ghost" className="text-primary text-[17px]">
            <Link href={`/bits/${bit.id}/edit`}>Edytuj</Link>
          </Button>
        }
      />
      <div className="mb-7 grid grid-cols-2 gap-3">
        <Stat label="Zagrany" value={`${rated.length}×`} />
        <Stat
          label="Jak siadał"
          value={gigs.some((g) => g.reaction != null) ? REACTIONS.map((r) => `${r.emoji} ${count(r.value)}`).join("  ") : "—"}
        />
      </div>
      {ready && (
        <div className="bg-st-ok/10 border-st-ok/30 mb-7 flex items-center gap-3 rounded-[14px] border px-4 py-3 has-[[data-pending]]:opacity-50">
          <p className="min-w-0 flex-1 text-[14px] leading-snug">
            Siada na scenie ({ready.thumbs}× 👍, min. {READY_THUMBS}) — może już <b className="font-semibold">Sprawdzony</b>?
            {ready.thisMonth && bit.lengthMin ? ` +${bit.lengthMin} min do MGM.` : ""}
          </p>
          <form action={markBitTested.bind(null, bit.id)}>
            <PendingButton className="bg-primary text-primary-foreground h-9 rounded-lg px-3 text-[14px] font-semibold active:scale-95">
              Sprawdzony
            </PendingButton>
          </form>
        </div>
      )}
      {bit.docUrl && (
        <a href={bit.docUrl} target="_blank" rel="noreferrer" className="bg-card border-border text-primary mb-7 flex h-12 items-center justify-center gap-2 rounded-[14px] border text-[16px] font-medium">
          Otwórz tekst <ExternalLink className="size-4" />
        </a>
      )}
      {data.sessions.length > 0 && (
        <Section title="Praca nad bitem">
          {data.sessions.slice(0, 8).map((s) => (
            <div key={s.id} className="border-border/70 flex items-baseline justify-between px-4 py-2.5 text-[15px] [&:not(:last-child)]:border-b">
              <span>{WRITING_LABEL[s.kind]}</span>
              <span className="text-muted-foreground text-[13px]">{fmtDate(s.date)}</span>
            </div>
          ))}
        </Section>
      )}
      {bit.notes && (
        <Section title="Notatki">
          <p className="px-4 py-3 text-[16px] whitespace-pre-wrap">{bit.notes}</p>
        </Section>
      )}
      <Section title="Grania z tym bitem">
        {gigs.length ? gigs.map((g) => <GigRow key={g.id} gig={g} />) : <Empty>Jeszcze nie zagrany.</Empty>}
      </Section>
      <Section>
        <ConfirmButton action={deleteBit.bind(null, bit.id)} confirm="Usunąć bit? Zniknie też z logów grań.">
          Usuń bit
        </ConfirmButton>
      </Section>
    </>
  );
}
