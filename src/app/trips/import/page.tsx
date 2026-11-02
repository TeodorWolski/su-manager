import { PageHeader } from "@/components/ios";
import { TripImport } from "./trip-import";

/**
 * Ekran „Dodać podróż?” — tu prowadzi skrót „Udostępnij → Dodaj do SU Manager” (iPhone)
 * i bookmarklet (komputer). Dane biletu są w adresie po „#” (nie trafiają do serwera ani logów).
 */
export default function TripImportPage() {
  return (
    <>
      <PageHeader title="Dodać podróż?" back={{ href: "/trips", label: "Podróże" }} />
      <TripImport />
    </>
  );
}
