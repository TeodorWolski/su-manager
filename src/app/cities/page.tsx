import { ChevronRight } from "lucide-react";
import { deleteCity, saveCity } from "@/app/actions";
import { FieldRow, NumberInput, Select, SubmitButton, TextInput, Toggle, PendingButton } from "@/components/form";
import { PageHeader, Pill, Section } from "@/components/ios";
import type { City } from "@/db/schema";
import { listCities } from "@/lib/queries";
import { fmtTravel } from "@/lib/time";

/** Maks. czas dojazdu w jedną stronę, przy którym miasto „wchodzi w grę”. */
const MAX_TRAVEL = 180;

const PRIORITIES = [
  { value: 1, label: "1 — Warszawa" },
  { value: 2, label: "2 — nocleg / ważne" },
  { value: 3, label: "3 — w zasięgu" },
];

function CityFields({ city }: { city?: City }) {
  return (
    <>
      {city && <input type="hidden" name="id" value={city.id} />}
      <FieldRow label="Nazwa">
        <TextInput name="name" required defaultValue={city?.name} />
      </FieldRow>
      <FieldRow label="Dojazd (min)">
        <NumberInput name="travelMinutes" defaultValue={city?.travelMinutes ?? ""} />
      </FieldRow>
      <FieldRow label="Priorytet">
        <Select name="priority" defaultValue={city?.priority ?? 3} placeholder="3" options={PRIORITIES} />
      </FieldRow>
      <FieldRow label="Mam nocleg">
        <Toggle name="hasLodging" defaultChecked={city?.hasLodging} />
      </FieldRow>
    </>
  );
}

export default async function CitiesPage() {
  const cities = await listCities();
  return (
    <>
      <PageHeader
        title="Miasta"
        subtitle="Czas dojazdu z Warszawy w jedną stronę. Wartości startowe są orientacyjne — popraw je."
        back={{ href: "/more", label: "Więcej" }}
      />
      <Section footer={`Miasto wchodzi w grę, gdy dojazd ≤ ${MAX_TRAVEL / 60} h albo masz tam nocleg.`}>
        {cities.map((c) => {
          const inRange = c.hasLodging || (c.travelMinutes != null && c.travelMinutes <= MAX_TRAVEL);
          return (
            <details key={c.id} className="group border-border/70 [&:not(:last-child)]:border-b">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className={`flex-1 text-[16px] ${inRange ? "" : "text-muted-foreground"}`}>{c.name}</span>
                {c.hasLodging && <Pill tone="success">nocleg</Pill>}
                {c.priority === 1 && <Pill tone="info">prio</Pill>}
                <span className="text-muted-foreground text-[15px] tabular-nums">{fmtTravel(c.travelMinutes) ?? "?"}</span>
                <ChevronRight className="text-muted-foreground/50 size-4 transition-transform group-open:rotate-90" />
              </summary>
              <div className="bg-muted/40 border-border/70 border-t">
                <form action={saveCity}>
                  <CityFields city={c} />
                  <div className="flex items-center gap-3 px-4 py-3">
                    <SubmitButton className="h-10 flex-1">Zapisz</SubmitButton>
                    <PendingButton formAction={deleteCity.bind(null, c.id)} className="text-destructive h-10 px-3 text-[15px]">
                      Usuń
                    </PendingButton>
                  </div>
                </form>
              </div>
            </details>
          );
        })}
      </Section>

      <form action={saveCity}>
        <Section title="Dodaj miasto">
          <CityFields />
        </Section>
        <SubmitButton>Dodaj</SubmitButton>
      </form>
    </>
  );
}
