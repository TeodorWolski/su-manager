import { Plus } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Pill, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { BIT_STATUS_LABEL, BIT_STATUS_TONE } from "@/lib/labels";
import { daysSince } from "@/lib/follow-up";
import { listBits } from "@/lib/queries";
import { nowLocal } from "@/lib/time";

/** Bit w testach, którego tyle dni nie grałem, trafia do „Do pracy” — dograć albo odpuścić. */
const STALE_DAYS = 21;

type BitItem = Awaited<ReturnType<typeof listBits>>[number];

function BitRow({ b, note }: { b: BitItem; note?: string }) {
  return (
    <Row
      href={`/bits/${b.id}`}
      title={b.name}
      subtitle={
        note ??
        [
          b.lengthMin && `${b.lengthMin} min`,
          `zagrany ${b.timesPlayed}×`,
          (b.ups > 0 || b.downs > 0) && `👍 ${b.ups} · 👎 ${b.downs}`,
        ]
          .filter(Boolean)
          .join(" · ")
      }
      detail={
        <Pill tone={BIT_STATUS_TONE[b.status]}>{BIT_STATUS_LABEL[b.status]}</Pill>
      }
    />
  );
}

export default async function BitsPage() {
  const items = await listBits();
  const today = nowLocal();
  const quiet = (b: BitItem) => daysSince(b.lastPlayed ?? b.createdAt, today);
  const toWork = items.filter((b) => b.status === "editing" || (b.status === "testing" && quiet(b) >= STALE_DAYS));
  const rest = items.filter((b) => !toWork.includes(b));
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
      {toWork.length > 0 && (
        <Section title="Do pracy" footer={`Do redakcji albo w testach i niegrane od ${STALE_DAYS}+ dni — dograj, popraw albo odrzuć.`}>
          {toWork.map((b) => (
            <BitRow
              key={b.id}
              b={b}
              note={
                b.status === "editing"
                  ? [b.lengthMin && `${b.lengthMin} min`, (b.ups > 0 || b.downs > 0) && `👍 ${b.ups} · 👎 ${b.downs}`, "do poprawy"].filter(Boolean).join(" · ")
                  : b.lastPlayed
                    ? `niegrany od ${quiet(b)} dni`
                    : `jeszcze niegrany · dodany ${quiet(b)} dni temu`
              }
            />
          ))}
        </Section>
      )}
      {(rest.length > 0 || items.length === 0) && (
        <Section footer="👍/👎 — jak siadł sam bit. Zaznaczasz w logu po graniu.">
          {rest.length ? (
            rest.map((b) => <BitRow key={b.id} b={b} />)
          ) : (
            <Empty>Dodaj swoje bity — potem wybierasz je w logu jednym tapnięciem.</Empty>
          )}
        </Section>
      )}
    </>
  );
}
