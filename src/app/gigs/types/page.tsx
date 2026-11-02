import Link from "next/link";
import { setGigContext } from "@/app/actions";
import { PendingButton } from "@/components/form";
import { Empty, PageHeader, Section } from "@/components/ios";
import { GIG_CONTEXTS } from "@/db/schema";
import { GIG_CONTEXT_LABEL } from "@/lib/labels";
import { listTypeSuspects } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Porządek w typach grań: bez typu i „open mic przed X” oznaczone jako open mic. Jeden tap = poprawiony typ;
 * przy „przed kimś” apka sama szuka headlinera w CRM po nazwisku z tytułu.
 */
export default async function GigTypesPage() {
  const list = await listTypeSuspects();
  return (
    <>
      <PageHeader title="Uzupełnij typ" subtitle={`${list.length} do sprawdzenia`} back={{ href: "/stats", label: "Statystyki" }} />
      <Section footer="„Open mic przed X” to darmowy slot przed headlinerem — w apce typ „Przed kimś”. Od typu zależą licznik występów, balans tygodnia i statystyki ocen.">
        {list.length ? (
          list.map((g) => (
            <div key={g.id} className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b has-[[data-pending]]:opacity-50">
              <Link href={`/gigs/${g.id}`} className="block text-[15px] leading-snug hover:underline">
                {g.title}
              </Link>
              <div className="text-muted-foreground text-[12.5px]">
                {[`${g.startsAt.slice(8, 10)}.${g.startsAt.slice(5, 7)}.${g.startsAt.slice(0, 4)}`, g.cityName, g.headlinerName && `przed ${g.headlinerName}`, g.reason]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GIG_CONTEXTS.map((c) => (
                  <form key={c} action={setGigContext.bind(null, g.id, c)}>
                    <PendingButton
                      className={cn(
                        "h-8 rounded-lg px-2.5 text-[13px] font-medium active:scale-95",
                        c === g.suggested ? "bg-primary text-primary-foreground" : g.context === c ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {GIG_CONTEXT_LABEL[c]}
                      {g.context === c && " ✓"}
                    </PendingButton>
                  </form>
                ))}
              </div>
            </div>
          ))
        ) : (
          <Empty>Wszystkie grania mają sensowny typ. 👌</Empty>
        )}
      </Section>
    </>
  );
}
