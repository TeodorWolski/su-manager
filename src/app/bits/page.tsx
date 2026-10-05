import { Plus } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Pill, Rating, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { BIT_STATUS_LABEL, BIT_STATUS_TONE } from "@/lib/labels";
import { listBits } from "@/lib/queries";

export default async function BitsPage() {
  const items = await listBits();
  const totalTested = items.filter((b) => b.status === "tested").reduce((s, b) => s + (b.lengthMin ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Materiał"
        back={{ href: "/more", label: "Więcej" }}
        subtitle={totalTested ? `${totalTested} min sprawdzonego materiału` : undefined}
        action={
          <Button asChild size="icon-lg" className="rounded-[10px]">
            <Link href="/bits/new" aria-label="Nowy bit">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      <Section footer="Ocena bitu = średnia ocen grań, w których go zagrałeś.">
        {items.length ? (
          items.map((b) => (
            <Row
              key={b.id}
              href={`/bits/${b.id}`}
              title={b.name}
              subtitle={[b.lengthMin && `${b.lengthMin} min`, `zagrany ${b.timesPlayed}×`].filter(Boolean).join(" · ")}
              detail={
                <span className="flex items-center gap-2">
                  <Rating value={b.avgRating} />
                  <Pill tone={BIT_STATUS_TONE[b.status]}>{BIT_STATUS_LABEL[b.status]}</Pill>
                </span>
              }
            />
          ))
        ) : (
          <Empty>Dodaj swoje bity — potem wybierasz je w logu jednym tapnięciem.</Empty>
        )}
      </Section>
    </>
  );
}
