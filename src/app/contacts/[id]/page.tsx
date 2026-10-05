import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addInteraction,
  deleteContact,
  deleteInteraction,
  setContactSnooze,
  snoozeContact,
  unhideContact,
  unsnoozeContact,
} from "@/app/actions";
import { ConfirmButton, FieldRow, Select, SubmitButton, TextInput } from "@/components/form";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Pill, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { IGNORE_REASON_LABEL, RELATION_LABEL, RELATION_TONE, ROLE_LABEL } from "@/lib/labels";
import { COOLDOWN_DAYS, mutedUntil } from "@/lib/opportunities";
import { getContact } from "@/lib/queries";
import { fmtDate, nowLocal } from "@/lib/time";

const CHANNELS = ["Instagram", "Messenger", "WhatsApp", "SMS", "Telefon", "Mail", "Na żywo"];

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const data = await getContact(Number(id));
  if (!data) notFound();
  const { contact, history } = data;
  const today = nowLocal().slice(0, 10);
  const lastPlayedTogether =
    data.gigs.filter((g) => g.status === "confirmed" && g.startsAt < today).map((g) => g.startsAt).sort().at(-1) ?? null;
  const muted = mutedUntil({ snoozeUntil: contact.snoozeUntil, lastPlayedTogether }, today);
  const manualSnooze = contact.snoozeUntil != null;

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
            {contact.ignoreInReport && <Pill tone="muted">pomijany w Okazjach</Pill>}
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

      {contact.role === "comedian" && (
        <Section
          title="Okazje"
          footer={
            contact.ignoreInReport
              ? "Jego występy nie pojawiają się w Okazjach ani w mailu."
              : muted && !manualSnooze
                ? `Automatycznie: ${COOLDOWN_DAYS} dni po wspólnym wieczorze (${fmtDate(lastPlayedTogether!)}).`
                : manualSnooze && !muted
                  ? "Pokazywany mimo niedawnego wspólnego wieczoru."
                  : undefined
          }
        >
          <div className="flex min-h-12 flex-wrap items-center gap-2 px-4 py-2.5">
            <span className="flex-1 text-[16px]">
              {contact.ignoreInReport
                ? `Pomijany · ${contact.ignoreReason ? IGNORE_REASON_LABEL[contact.ignoreReason] : "bez powodu"}`
                : muted
                  ? `Wyciszony do ${fmtDate(muted)}`
                  : "Widoczny"}
            </span>
            {contact.ignoreInReport ? (
              <form action={unhideContact.bind(null, contact.id)}>
                <button type="submit" className="text-primary h-9 text-[15px]">Przywróć</button>
              </form>
            ) : muted ? (
              <form action={unsnoozeContact.bind(null, contact.id)}>
                <button type="submit" className="text-primary h-9 text-[15px]">Pokaż teraz</button>
              </form>
            ) : (
              <form action={snoozeContact.bind(null, contact.id, 90)}>
                <button type="submit" className="text-primary h-9 text-[15px]">Wycisz na 3 mies.</button>
              </form>
            )}
            {manualSnooze && !contact.ignoreInReport && (
              <form action={setContactSnooze.bind(null, contact.id, null)}>
                <button type="submit" className="text-muted-foreground h-9 text-[15px]">Automatycznie</button>
              </form>
            )}
          </div>
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
