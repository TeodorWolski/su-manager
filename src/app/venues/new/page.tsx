import { PageHeader } from "@/components/ios";
import { VenueForm } from "@/components/venue-form";
import { getFormOptions } from "@/lib/queries";

export default async function NewVenuePage() {
  const options = await getFormOptions();
  return (
    <>
      <PageHeader title="Nowa scena" back={{ href: "/venues", label: "Sceny" }} />
      <VenueForm options={options} />
    </>
  );
}
