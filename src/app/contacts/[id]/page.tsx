import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addInteraction,
  addSupport,
  deleteContact,
  deleteSupport,
  deleteInteraction,
  setContactSnooze,
  setSupportActive,
  snoozeContact,
  unhideContact,
  unsnoozeContact,
} from "@/app/actions";
import { ConfirmButton, FieldRow, NEW, Select, SelectOrNew, SubmitButton, TextInput, PendingButton } from "@/components/form";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Pill, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { CHANNELS, IGNORE_REASON_LABEL, RELATION_LABEL, RELATION_TONE, ROLE_LABEL } from "@/lib/labels";
import { ACTIVE_GIG, COOLDOWN_DAYS, muteState } from "@/lib/opportunities";
import { getContact, getFormOptions, listSupportedBy, listSupports } from "@/lib/queries";
import { loadLeadTimes } from "@/lib/lead-data";
import { leadLabel, PERSONAL_MIN } from "@/lib/lead-time";
import { plural } from "@/lib/text";
import { fmtDate, nowLocal } from "@/lib/time";

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const [data, leads, supportList, supportFor, options] = await Promise.all([
    getContact(Number(id)),
    loadLeadTimes(),
    listSupports(Number(id)),
    listSupportedBy(Number(id)),
    getFormOptions(),
  ]);
  if (!data) notFound();
  const lead = leads.leadFor(data.contact.id, "opener");
  const { contact, history } = data;
  const today = nowLocal().slice(0, 10);
  const lastPlayedTogether =
    data.gigs.filter((g) => g.status === "confirmed" && g.startsAt < today).map((g) => g.startsAt).sort().at(-1) ?? null;
  const nextGig = data.gigs
    .filter((g) => ACTIVE_GIG.includes(g.status) && g.startsAt >= today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const mute = muteState(
    {
      snoozeUntil: contact.snoozeUntil,
      lastPlayedTogether,
      nextGig: nextGig?.startsAt ?? null,
      nextGigCreatedAt: nextGig?.createdAt ?? null,
    },
    today,
  );
  const muted = mute?.until ?? null;
  const manualSnooze = contact.snoozeUntil != null;
  const muteNote = {
    manual: "Wyciszony ręcznie albo po odmowie / ghostingu.",
    gig: `Macie granie w toku (${nextGig ? fmtDate(nextGig.startsAt) : ""}) — nie proponuję kolejnych terminów. Potem jeszcze ${COOLDOWN_DAYS} dni przerwy.`,
    played: `${COOLDOWN_DAYS} dni po wspólnym wieczorze (${lastPlayedTogether ? fmtDate(lastPlayedTogether) : ""}).`,
  };

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
              : mute
                ? muteNote[mute.reason]
                : manualSnooze
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
                <PendingButton className="text-primary h-9 text-[15px]">Przywróć</PendingButton>
              </form>
            ) : muted ? (
              <form action={unsnoozeContact.bind(null, contact.id)}>
                <PendingButton className="text-primary h-9 text-[15px]">Pokaż teraz</PendingButton>
              </form>
            ) : (
              <form action={snoozeContact.bind(null, contact.id, 30)}>
                <PendingButton className="text-primary h-9 text-[15px]">Wycisz na miesiąc</PendingButton>
              </form>
            )}
            {manualSnooze && !contact.ignoreInReport && (
              <form action={setContactSnooze.bind(null, contact.id, null)}>
                <PendingButton className="text-muted-foreground h-9 text-[15px]">Automatycznie</PendingButton>
              </form>
            )}
          </div>
        </Section>
      )}

      {contact.role === "comedian" && (
        <Section
          title="Supporty"
          footer="Do dużych headlinerów na open mica często pisze się przez supportu — on pyta headlinera. Supporty się zmieniają: „już nie robi” zostawia historię, ale nie podpowiada go więcej. Para dopisuje się też sama, gdy przy graniu wyślesz „Napisz do supportu”."
        >
          {supportList.map((x) => (
            <div key={x.id} className="border-border/70 flex items-center gap-2 border-b px-4 py-2.5 has-[[data-pending]]:opacity-50">
              <Link href={`/contacts/${x.contactId}`} className="min-w-0 flex-1">
                <div className={x.active ? "text-[15px]" : "text-muted-foreground text-[15px] line-through"}>{x.name}</div>
                <div className="text-muted-foreground text-[12px]">
                  {x.active ? "aktualny" : "już nie robi"}
                  {x.lastSeen && ` · ostatnio ${fmtDate(x.lastSeen)}`}
                </div>
              </Link>
              <form action={setSupportActive.bind(null, x.id, !x.active)}>
                <PendingButton className="text-primary h-8 px-1 text-[13px]">{x.active ? "Już nie robi" : "Znowu robi"}</PendingButton>
              </form>
              <form action={deleteSupport.bind(null, x.id)}>
                <PendingButton className="text-muted-foreground/60 hover:text-destructive px-1 text-lg" aria-label="Usuń">
                  ×
                </PendingButton>
              </form>
            </div>
          ))}
          <form action={addSupport.bind(null, contact.id)} className="flex items-center gap-2 px-4 py-2">
            <span className="min-w-0 flex-1">
              <SelectOrNew
                key={supportList.length}
                name="supportId"
                newName="supportName"
                newPlaceholder="imię i nazwisko supportu"
                placeholder="Dodaj supportu…"
                defaultValue={supportList.length ? undefined : NEW}
                options={options.contacts
                  .filter((c) => c.role === "comedian" && c.id !== contact.id && !supportList.some((x) => x.contactId === c.id))
                  .map((c) => ({ value: c.id, label: c.name }))}
              />
            </span>
            <PendingButton className="bg-primary text-primary-foreground h-9 shrink-0 rounded-lg px-3 text-[14px] font-semibold">Dodaj</PendingButton>
          </form>
        </Section>
      )}

      {supportFor.length > 0 && (
        <Section title="Robi support u" footer="Przez niego możesz zapytać tych headlinerów o open mica.">
          {supportFor.map((x) => (
            <Row
              key={x.id}
              href={`/contacts/${x.contactId}`}
              title={<span className={x.active ? undefined : "text-muted-foreground line-through"}>{x.name}</span>}
              detail={x.active ? (x.lastSeen ? `ostatnio ${fmtDate(x.lastSeen)}` : "aktualnie") : "już nie"}
            />
          ))}
        </Section>
      )}

      {contact.role === "comedian" && (
        <Section
          title="Kiedy pisać"
          footer="Liczone z rozmów z wynikiem: przy „zgodził się” — ile dni przed graniem napisałeś; „ktoś zajął miejsce” — że to było za późno. Z tego przypomnienia „napisz” i Najgorętsze okazje."
        >
          <div className="px-4 py-3 text-[15px]">
            {lead.personal ? (
              <>
                Pisz <b className="font-semibold">{leadLabel(lead.days)}</b> przed graniem
                <span className="text-muted-foreground">
                  {" "}
                  · {plural(lead.agreed, "zgoda", "zgody", "zgód")}
                  {lead.taken > 0 && `, ${lead.taken}× ktoś zajął miejsce`}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                Za mało rozmów z wynikiem (min. {PERSONAL_MIN}) — przypominam {leadLabel(lead.days)} przed, jak przy innych komikach.
              </span>
            )}
          </div>
        </Section>
      )}

      <Section title="Historia kontaktu">
        {history.length ? (
          history.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-[16px]">
                  {i.gigId ? (
                    <Link href={`/gigs/${i.gigId}`} className="hover:underline">
                      {i.topic || i.channel}
                    </Link>
                  ) : (
                    i.topic || i.channel
                  )}
                </div>
                <div className="text-muted-foreground text-[13px]">
                  {fmtDate(i.date)} · {i.channel}
                  {i.contactId && i.contactId !== contact.id && i.contactName && ` · przez supportu: ${i.contactName}`}
                </div>
              </div>
              {i.replied != null && <Pill tone={i.replied ? "success" : "warning"}>{i.replied ? "odpisał" : "cisza"}</Pill>}
              <form action={deleteInteraction.bind(null, i.id, contact.id)}>
                <PendingButton className="text-muted-foreground/60 hover:text-destructive px-1 text-lg" aria-label="Usuń wpis">
                  ×
                </PendingButton>
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
