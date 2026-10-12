import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ios";
import { LogForm } from "@/components/log-form";
import { getFormOptions, getGig } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";

export default async function GigLogPage({ params }: PageProps<"/gigs/[id]/log">) {
  const { id } = await params;
  const [data, options] = await Promise.all([getGig(Number(id)), getFormOptions()]);
  if (!data) notFound();
  const { gig, log } = data;
  return (
    <>
      <PageHeader
        title={log ? "Edytuj log" : "Jak wypadło?"}
        subtitle={`${gig.title} · ${fmtDateTime(gig.startsAt)}`}
        back={{ href: `/gigs/${id}`, label: "Wróć" }}
      />
      <LogForm
        gigId={gig.id}
        title={gig.title}
        options={options}
        defaults={{
          ...log,
          context: gig.context,
          headlinerId: gig.headlinerId,
          bitIds: data.bits.map((b) => b.id),
          reactions: Object.fromEntries(data.bits.map((b) => [b.id, b.reaction])),
        }}
      />
    </>
  );
}
