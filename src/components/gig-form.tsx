import { saveGig } from "@/app/actions";
import { GIG_STATUSES, type Gig } from "@/db/schema";
import { GIG_CONTEXT_LABEL, GIG_STATUS_LABEL } from "@/lib/labels";
import type { FormOptions } from "@/lib/queries";
import { effectiveStart } from "@/lib/time";
import { Chips } from "./chips";
import { FieldRow, Select, SelectOrNew, SubmitButton, TextArea, TextInput } from "./form";
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

      <Section
        title="Gdzie"
        footer="Wybierz scenę z katalogu albo samo miasto, jeśli to jednorazowe miejsce. Nie ma na liście? „Wpisz inne…” — dodam do katalogu."
      >
        <FieldRow label="Scena">
          <SelectOrNew
            name="venueId"
            newName="venueName"
            defaultValue={gig?.venueId}
            newPlaceholder="nazwa sceny"
            options={options.venues.map((v) => ({ value: v.id, label: v.cityName ? `${v.name} · ${v.cityName}` : v.name }))}
          />
        </FieldRow>
        <FieldRow label="Miasto">
          <SelectOrNew
            name="cityId"
            newName="cityName"
            defaultValue={gig?.cityId}
            placeholder="z miejsca sceny"
            newPlaceholder="nazwa miasta"
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
          <SelectOrNew
            name="headlinerId"
            newName="headlinerName"
            defaultValue={gig?.headlinerId}
            newPlaceholder="imię i nazwisko"
            options={comedians}
          />
        </FieldRow>
        <FieldRow label="Link">
          <TextInput name="url" type="url" defaultValue={gig?.url ?? ""} placeholder="https://" />
        </FieldRow>
      </Section>

      <div className="mb-7">
        <div className="text-muted-foreground mb-1.5 px-1 text-[12.5px] font-medium">Kto jeszcze gra</div>
        <Chips name="lineup" selected={lineup} options={comedians} empty="Nikogo jeszcze nie ma w Ludziach — dopisz poniżej." />
        <input
          name="lineupNew"
          placeholder="Ktoś spoza listy? Wpisz, po przecinku"
          className="bg-card placeholder:text-muted-foreground/60 mt-2 h-10 w-full rounded-xl px-4 text-[15px] outline-none"
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
