import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/ios";
import { getContact } from "@/lib/queries";

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const { id } = await params;
  const data = await getContact(Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Edytuj kontakt" back={{ href: `/contacts/${id}`, label: "Wróć" }} />
      <ContactForm contact={data.contact} />
    </>
  );
}
