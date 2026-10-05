import { notFound } from "next/navigation";
import { GigForm } from "@/components/gig-form";
import { PageHeader } from "@/components/ios";
import { getFormOptions, getGig } from "@/lib/queries";

export default async function EditGigPage({ params }: PageProps<"/gigs/[id]/edit">) {
  const { id } = await params;
  const [data, options] = await Promise.all([getGig(Number(id)), getFormOptions()]);
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Edytuj granie" back={{ href: `/gigs/${id}`, label: "Wróć" }} />
      <GigForm gig={data.gig} lineup={data.lineup.map((c) => c.id)} options={options} />
    </>
  );
}
