import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ios";
import { VenueForm } from "@/components/venue-form";
import { getFormOptions, getVenue } from "@/lib/queries";

export default async function EditVenuePage({ params }: PageProps<"/venues/[id]/edit">) {
  const { id } = await params;
  const [data, options] = await Promise.all([getVenue(Number(id)), getFormOptions()]);
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Edytuj scenę" back={{ href: `/venues/${id}`, label: "Wróć" }} />
      <VenueForm venue={data.venue} options={options} />
    </>
  );
}
