import { saveContact } from "@/app/actions";
import type { Contact } from "@/db/schema";
import { RELATION_LABEL, ROLE_LABEL } from "@/lib/labels";
import { FieldRow, Select, SubmitButton, TextArea, TextInput, Toggle } from "./form";
import { Section } from "./ios";

export function ContactForm({ contact }: { contact?: Contact }) {
  return (
    <form action={saveContact}>
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <Section>
        <FieldRow label="Imię i nazwisko">
          <TextInput name="name" required defaultValue={contact?.name} />
        </FieldRow>
        <FieldRow label="Rola">
          <Select
            name="role"
            placeholder="Komik"
            defaultValue={contact?.role ?? "comedian"}
            options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </FieldRow>
        <FieldRow label="Relacja">
          <Select
            name="relation"
            defaultValue={contact?.relation ?? "none"}
            options={Object.entries(RELATION_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </FieldRow>
        <FieldRow label="Kontakt">
          <TextInput name="contactInfo" defaultValue={contact?.contactInfo ?? ""} placeholder="IG, tel., mail" />
        </FieldRow>
      </Section>

      <Section footer="Inne zapisy nazwiska / pseudonim, po przecinku. Pomogą dopasować komika z bileterii.">
        <FieldRow label="Aliasy">
          <TextInput name="aliases" defaultValue={contact?.aliases ?? ""} placeholder="np. Kuba, Jakub R." />
        </FieldRow>
      </Section>

      <Section footer="Np. gwiazdy, które nie biorą supportów — nie będą zaśmiecać raportu nowych grań.">
        <FieldRow label="Pomijaj w raporcie">
          <Toggle name="ignoreInReport" defaultChecked={contact?.ignoreInReport} />
        </FieldRow>
      </Section>

      <Section>
        <div className="px-4 py-3">
          <TextArea name="notes" defaultValue={contact?.notes ?? ""} placeholder="Notatki" />
        </div>
      </Section>

      <SubmitButton>{contact ? "Zapisz zmiany" : "Dodaj kontakt"}</SubmitButton>
    </form>
  );
}
