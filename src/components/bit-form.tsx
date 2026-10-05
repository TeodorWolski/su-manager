import { saveBit } from "@/app/actions";
import type { Bit } from "@/db/schema";
import { BIT_STATUS_LABEL } from "@/lib/labels";
import { FieldRow, NumberInput, Select, SubmitButton, TextArea, TextInput } from "./form";
import { Section } from "./ios";

export function BitForm({ bit }: { bit?: Bit }) {
  return (
    <form action={saveBit}>
      {bit && <input type="hidden" name="id" value={bit.id} />}
      <Section>
        <FieldRow label="Nazwa">
          <TextInput name="name" required defaultValue={bit?.name} placeholder="np. basen" />
        </FieldRow>
        <FieldRow label="Status">
          <Select
            name="status"
            placeholder="W testach"
            defaultValue={bit?.status ?? "testing"}
            options={Object.entries(BIT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </FieldRow>
        <FieldRow label="Długość">
          <NumberInput name="lengthMin" defaultValue={bit?.lengthMin ?? ""} placeholder="min" />
        </FieldRow>
      </Section>
      <Section>
        <div className="px-4 py-3">
          <TextArea name="notes" defaultValue={bit?.notes ?? ""} placeholder="Premisa, tagi, callbacki…" />
        </div>
      </Section>
      <SubmitButton>{bit ? "Zapisz zmiany" : "Dodaj bit"}</SubmitButton>
    </form>
  );
}
