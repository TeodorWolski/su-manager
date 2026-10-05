import { Plus } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Pill, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/db/schema";
import { RELATION_LABEL, RELATION_TONE, ROLE_LABEL } from "@/lib/labels";
import { listContacts } from "@/lib/queries";
import { fmtDate } from "@/lib/time";

const GROUPS: { role: Contact["role"]; title: string }[] = [
  { role: "comedian", title: "Komicy" },
  { role: "organizer", title: "Organizatorzy" },
  { role: "venue", title: "Sceny" },
];

export default async function ContactsPage() {
  const all = await listContacts();
  return (
    <>
      <PageHeader
        title="Ludzie"
        subtitle={`${all.length} kontaktów`}
        action={
          <Button asChild size="icon-lg" className="rounded-full">
            <Link href="/contacts/new" aria-label="Nowy kontakt">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      {all.length === 0 && (
        <Section>
          <Empty>Dodaj pierwszych komików i organizatorów.</Empty>
        </Section>
      )}
      {GROUPS.map(({ role, title }) => {
        const items = all.filter((c) => c.role === role);
        if (!items.length) return null;
        return (
          <Section key={role} title={title}>
            {items.map((c) => (
              <Row
                key={c.id}
                href={`/contacts/${c.id}`}
                title={c.name}
                subtitle={
                  [
                    c.lastPlayedTogether && `wspólny wieczór ${fmtDate(c.lastPlayedTogether)}`,
                    c.lastInteraction && `kontakt ${fmtDate(c.lastInteraction)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || ROLE_LABEL[c.role]
                }
                detail={c.relation !== "none" && <Pill tone={RELATION_TONE[c.relation]}>{RELATION_LABEL[c.relation]}</Pill>}
              />
            ))}
          </Section>
        );
      })}
    </>
  );
}
