import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/ios";

export default function NewContactPage() {
  return (
    <>
      <PageHeader title="Nowy kontakt" back={{ href: "/contacts", label: "Ludzie" }} />
      <ContactForm />
    </>
  );
}
