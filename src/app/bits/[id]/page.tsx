import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBit } from "@/app/actions";
import { ConfirmButton } from "@/components/form";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Pill, Rating, Section, Stat } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { BIT_STATUS_LABEL, BIT_STATUS_TONE, REACTIONS } from "@/lib/labels";
import { getBit } from "@/lib/queries";

export default async function BitPage({ params }: PageProps<"/bits/[id]">) {
  const { id } = await params;
  const data = await getBit(Number(id));
  if (!data) notFound();
  const { bit, gigs } = data;
  const rated = gigs.filter((g) => g.rating != null);
  const avg = rated.length ? rated.reduce((s, g) => s + g.rating!, 0) / rated.length : null;
  const count = (r: number) => gigs.filter((g) => g.reaction === r).length;

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
        <Stat label="Średnia grań" value={avg ? <Rating value={avg} /> : "—"} />
        {gigs.some((g) => g.reaction != null) && (
          <div className="col-span-2">
            <Stat
              label="Jak siadał"
              value={REACTIONS.map((r) => `${r.emoji} ${count(r.value)}`).join("   ")}
            />
          </div>
        )}
      </div>
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
