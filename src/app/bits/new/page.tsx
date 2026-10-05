import { BitForm } from "@/components/bit-form";
import { PageHeader } from "@/components/ios";

export default function NewBitPage() {
  return (
    <>
      <PageHeader title="Nowy bit" back={{ href: "/bits", label: "Materiał" }} />
      <BitForm />
    </>
  );
}
