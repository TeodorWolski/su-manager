import { notFound } from "next/navigation";
import { BitForm } from "@/components/bit-form";
import { PageHeader } from "@/components/ios";
import { getBit } from "@/lib/queries";

export default async function EditBitPage({ params }: PageProps<"/bits/[id]/edit">) {
  const { id } = await params;
  const data = await getBit(Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Edytuj bit" back={{ href: `/bits/${id}`, label: "Wróć" }} />
      <BitForm bit={data.bit} />
    </>
  );
}
