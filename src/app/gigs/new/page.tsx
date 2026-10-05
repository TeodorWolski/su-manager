import { GigForm } from "@/components/gig-form";
import { PageHeader } from "@/components/ios";
import { getFormOptions } from "@/lib/queries";

export default async function NewGigPage() {
  const options = await getFormOptions();
  return (
    <>
      <PageHeader title="Nowe granie" back={{ href: "/gigs", label: "Grania" }} />
      <GigForm options={options} />
    </>
  );
}
