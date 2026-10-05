import { saveVenue } from "@/app/actions";
import { VENUE_VERDICTS, type Venue } from "@/db/schema";
import { VERDICT_LABEL } from "@/lib/labels";
import type { FormOptions } from "@/lib/queries";
import { FieldRow, NumberInput, Select, SubmitButton, TextArea, TextInput, Toggle } from "./form";
import { Section } from "./ios";

export function VenueForm({ venue, options }: { venue?: Venue; options: FormOptions }) {
  return (
    <form action={saveVenue}>
      {venue && <input type="hidden" name="id" value={venue.id} />}
      <Section>
        <FieldRow label="Nazwa">
          <TextInput name="name" required defaultValue={venue?.name} placeholder="np. Resort Komedii" />
        </FieldRow>
        <FieldRow label="Miasto">
          <Select name="cityId" defaultValue={venue?.cityId ?? ""} options={options.cities.map((c) => ({ value: c.id, label: c.name }))} />
        </FieldRow>
        <FieldRow label="Cykliczność">
          <TextInput name="recurrence" defaultValue={venue?.recurrence ?? ""} placeholder="np. co wtorek" />
        </FieldRow>
        <FieldRow label="Organizator">
          <Select
            name="organizerId"
            defaultValue={venue?.organizerId ?? ""}
            options={options.contacts.filter((c) => c.role !== "comedian").map((c) => ({ value: c.id, label: c.name }))}
          />
        </FieldRow>
      </Section>

      <Section footer="Puste = czas dojazdu z tabeli miast.">
        <FieldRow label="Dojazd (min)">
          <NumberInput name="travelMinutes" defaultValue={venue?.travelMinutes ?? ""} placeholder="z miasta" />
        </FieldRow>
        <FieldRow label="Mam nocleg">
          <Toggle name="hasLodging" defaultChecked={venue?.hasLodging} />
        </FieldRow>
      </Section>

      <Section title="Moja ocena" footer="„Nie wracam” = czarna lista.">
        <FieldRow label="Ocena">
          <Select
            name="verdict"
            placeholder="nie oceniłem"
            defaultValue={venue?.verdict ?? ""}
            options={VENUE_VERDICTS.map((v) => ({ value: v, label: VERDICT_LABEL[v] }))}
          />
        </FieldRow>
        <FieldRow label="Dlaczego">
          <TextInput name="verdictNote" defaultValue={venue?.verdictNote ?? ""} placeholder="np. pusta sala, nikt nie słucha" />
        </FieldRow>
      </Section>

      <Section>
        <div className="px-4 py-3">
          <TextArea name="notes" defaultValue={venue?.notes ?? ""} placeholder="Notatki (scena, nagłośnienie, publika…)" />
        </div>
      </Section>
      <SubmitButton>{venue ? "Zapisz zmiany" : "Dodaj scenę"}</SubmitButton>
    </form>
  );
}
