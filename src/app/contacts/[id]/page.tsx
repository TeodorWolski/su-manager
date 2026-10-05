import Link from "next/link";
import { notFound } from "next/navigation";
import { addInteraction, deleteContact, deleteInteraction } from "@/app/actions";
import { ConfirmButton, FieldRow, Select, SubmitButton, TextInput } from "@/components/form";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Pill, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { RELATION_LABEL, RELATION_TONE, ROLE_LABEL } from "@/lib/labels";
import { getContact } from "@/lib/queries";
import { fmtDate, nowLocal } from "@/lib/time";

const CHANNELS = ["Instagram", "Messenger", "WhatsApp", "SMS", "Telefon", "Mail", "Na żywo"];

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const data = await getContact(Number(id));
  if (!data) notFound();
  const { contact, history } = data;

  return (
    <>
      <PageHeader
        title={contact.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {ROLE_LABEL[contact.role]}
            {contact.relation !== "none" && (
              <Pill tone={RELATION_TONE[contact.relation]}>{RELATION_LABEL[contact.relation]}</Pill>
            )}
            {contact.ignoreInReport && <Pill tone="muted">pomijany w raporcie</Pill>}
          </span>
        }
        back={{ href: "/contacts", label: "Ludzie" }}
        action={
          <Button asChild variant="ghost" className="text-primary text-[17px]">
            <Link href={`/contacts/${contact.id}/edit`}>Edytuj</Link>
          </Button>
        }
      />

      {(contact.contactInfo || contact.aliases || contact.notes) && (
        <Section>
          {contact.contactInfo && <Row title="Kontakt" detail={<span className="select-all">{contact.contactInfo}</span>} />}
          {contact.aliases && <Row title="Aliasy" detail={contact.aliases} />}
          {contact.notes && <p className="px-4 py-3 text-[16px] whitespace-pre-wrap">{contact.notes}</p>}
        </Section>
      )}

      <Section title="Historia kontaktu">
        {history.length ? (
          history.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-[16px]">{i.topic || i.channel}</div>
                <div className="text-muted-foreground text-[13px]">
                  {fmtDate(i.date)} · {i.channel}
                </div>
              </div>
              {i.replied != null && <Pill tone={i.replied ? "success" : "warning"}>{i.replied ? "odpisał" : "cisza"}</Pill>}
              <form action={deleteInteraction.bind(null, i.id, contact.id)}>
                <button type="submit" className="text-muted-foreground/60 hover:text-destructive px-1 text-lg" aria-label="Usuń wpis">
                  ×
                </button>
              </form>
            </div>
          ))
        ) : (
          <Empty>Brak wpisów.</Empty>
        )}
      </Section>

      <form action={addInteraction}>
        <input type="hidden" name="contactId" value={contact.id} />
        <Section title="Dodaj wpis">
          <FieldRow label="Data">
            <TextInput name="date" type="date" required defaultValue={nowLocal().slice(0, 10)} />
          </FieldRow>
          <FieldRow label="Kanał">
            <Select name="channel" defaultValue="Instagram" options={CHANNELS.map((c) => ({ value: c, label: c }))} />
          </FieldRow>
          <FieldRow label="O co chodziło">
            <TextInput name="topic" placeholder="np. support 14.11" />
          </FieldRow>
          <FieldRow label="Odpisał?">
            <Select
              name="replied"
              placeholder="jeszcze nie wiem"
              options={[
                { value: "yes", label: "Tak" },
                { value: "no", label: "Nie" },
              ]}
            />
          </FieldRow>
        </Section>
        <SubmitButton className="mb-7">Dodaj wpis</SubmitButton>
      </form>

      {data.gigs.length > 0 && (
        <Section title="Wspólne grania">
          {data.gigs.map((g) => (
            <GigRow key={g.id} gig={g} />
          ))}
        </Section>
      )}

      <Section>
        <ConfirmButton action={deleteContact.bind(null, contact.id)} confirm="Usunąć kontakt i całą historię?">
          Usuń kontakt
        </ConfirmButton>
      </Section>
    </>
  );
}
