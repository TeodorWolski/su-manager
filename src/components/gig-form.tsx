import { saveGig } from "@/app/actions";
import { GIG_STATUSES, type Gig } from "@/db/schema";
import { GIG_CONTEXT_LABEL, GIG_STATUS_LABEL } from "@/lib/labels";
import type { FormOptions } from "@/lib/queries";
import { effectiveStart } from "@/lib/time";
import { Chips } from "./chips";
import { FieldRow, Select, SubmitButton, TextArea, TextInput } from "./form";
import { Section } from "./ios";

const HIDDEN_REASONS: readonly string[] = ["not_interested", "no_openers"];

export function GigForm({
  gig,
  lineup = [],
  options,
}: {
  gig?: Gig;
  lineup?: number[];
  options: FormOptions;
}) {
  // Bez komików ukrytych z powodu „nie interesuje mnie” / „nie robi open miców przed sobą” —
  // chyba że już są wybrani w edytowanym graniu.
  const keep = new Set([gig?.headlinerId, ...lineup]);
  const comedians = options.contacts
    .filter((c) => c.role === "comedian")
    .filter((c) => keep.has(c.id) || !(c.ignoreReason && HIDDEN_REASONS.includes(c.ignoreReason)))
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <form action={saveGig}>
      {gig && <input type="hidden" name="id" value={gig.id} />}
      <Section>
        <FieldRow label="Nazwa">
          <TextInput name="title" required defaultValue={gig?.title} placeholder="np. Open mic Resort" />
        </FieldRow>
        <FieldRow label="Kiedy">
          <TextInput
            name="startsAt"
            type="datetime-local"
            required
            // Grania z importu mają samą datę — datetime-local potrzebuje godziny.
            defaultValue={gig ? effectiveStart(gig.startsAt) : undefined}
          />
        </FieldRow>
        <FieldRow label="Status">
          <Select
            name="status"
            defaultValue={gig?.status ?? "confirmed"}
            options={GIG_STATUSES.map((s) => ({ value: s, label: GIG_STATUS_LABEL[s] }))}
          />
        </FieldRow>
      </Section>

      <Section title="Gdzie" footer="Wybierz scenę z katalogu albo samo miasto, jeśli to jednorazowe miejsce.">
        <FieldRow label="Scena">
          <Select
            name="venueId"
            defaultValue={gig?.venueId ?? ""}
            options={options.venues.map((v) => ({ value: v.id, label: v.cityName ? `${v.name} · ${v.cityName}` : v.name }))}
          />
        </FieldRow>
        <FieldRow label="Miasto">
          <Select
            name="cityId"
            defaultValue={gig?.cityId ?? ""}
            placeholder="z miejsca sceny"
            options={options.cities.map((c) => ({ value: c.id, label: c.name }))}
          />
        </FieldRow>
      </Section>

      <Section title="Kontekst">
        <FieldRow label="Typ">
          <Select
            name="context"
            defaultValue={gig?.context ?? ""}
            options={Object.entries(GIG_CONTEXT_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </FieldRow>
        <FieldRow label="Przed kim">
          <Select
            name="headlinerId"
            defaultValue={gig?.headlinerId ?? ""}
            options={comedians}
          />
        </FieldRow>
        <FieldRow label="Link">
          <TextInput name="url" type="url" defaultValue={gig?.url ?? ""} placeholder="https://" />
        </FieldRow>
      </Section>

      <div className="mb-7">
        <div className="text-muted-foreground mb-1.5 px-1 text-[12.5px] font-medium">Kto jeszcze gra</div>
        <Chips
          name="lineup"
          selected={lineup}
          options={comedians}
          empty="Dodaj komików w zakładce Ludzie, żeby oznaczać, z kim grasz."
        />
      </div>

      <Section>
        <div className="px-4 py-3">
          <TextArea name="notes" defaultValue={gig?.notes ?? ""} placeholder="Notatki (godzina zbiórki, ile minut, kontakt na miejscu…)" />
        </div>
      </Section>

      <SubmitButton>{gig ? "Zapisz zmiany" : "Dodaj granie"}</SubmitButton>
    </form>
  );
}
