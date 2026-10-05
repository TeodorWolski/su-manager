import { Plus } from "lucide-react";
import Link from "next/link";
import { setVenueVerdict } from "@/app/actions";
import { Empty, PageHeader, Pill, Rating, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { VENUE_VERDICTS, type VenueVerdict } from "@/db/schema";
import { VERDICT_LABEL, VERDICT_SHORT, VERDICT_TONE } from "@/lib/labels";
import { listVenues } from "@/lib/queries";
import { fmtTravel } from "@/lib/time";
import { cn } from "@/lib/utils";

type VenueItem = Awaited<ReturnType<typeof listVenues>>[number];

const QUICK_STYLE: Record<VenueVerdict, string> = {
  never: "bg-destructive/12 text-destructive",
  weak: "bg-warning/15 text-amber-700 dark:text-warning",
  meh: "bg-secondary text-secondary-foreground",
  good: "bg-primary/14 text-primary",
  great: "bg-primary text-primary-foreground",
};

const subtitle = (v: VenueItem) =>
  [v.cityName, v.recurrence, fmtTravel(v.travelMinutes), v.hasLodging && "nocleg"].filter(Boolean).join(" · ");

function VenueRow({ v }: { v: VenueItem }) {
  return (
    <Row
      href={`/venues/${v.id}`}
      title={v.name}
      subtitle={subtitle(v)}
      detail={
        <span className="flex items-center gap-2">
          {v.gigCount > 0 && <span className="text-[13px]">{v.gigCount}×</span>}
          {v.venueAvg != null && (
            <span className="text-[13px]">
              miejsce <Rating value={v.venueAvg} />
            </span>
          )}
        </span>
      }
    />
  );
}

/** Wiersz z szybką oceną — formularze nie mogą siedzieć w linku, więc osobny układ. */
function UnratedRow({ v }: { v: VenueItem }) {
  return (
    <div className="border-border/70 px-4 py-2.5 [&:not(:last-child)]:border-b">
      <Link href={`/venues/${v.id}`} className="block">
        <div className="truncate text-[16px]">{v.name}</div>
        <div className="text-muted-foreground truncate text-[13px]">{subtitle(v)}</div>
      </Link>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {VENUE_VERDICTS.map((verdict) => (
          <form key={verdict} action={setVenueVerdict.bind(null, v.id, verdict)}>
            <button
              type="submit"
              className={cn(
                "h-11 w-full rounded-lg px-0.5 text-[12px] leading-tight font-medium active:scale-95 sm:text-[13px]",
                QUICK_STYLE[verdict],
              )}
            >
              {VERDICT_SHORT[verdict]}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

export default async function VenuesPage() {
  const all = await listVenues();
  const unrated = all.filter((v) => !v.verdict);

  return (
    <>
      <PageHeader
        title="Sceny"
        back={{ href: "/more", label: "Więcej" }}
        action={
          <Button asChild size="icon-lg" className="rounded-full">
            <Link href="/venues/new" aria-label="Nowa scena">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      {all.length === 0 && (
        <Section>
          <Empty>Brak scen.</Empty>
        </Section>
      )}
      {unrated.length > 0 && (
        <Section title={`Do oceny · ${unrated.length}`}>
          {unrated.map((v) => (
            <UnratedRow key={v.id} v={v} />
          ))}
        </Section>
      )}
      {[...VENUE_VERDICTS].reverse().map((verdict) => {
        const items = all.filter((v) => v.verdict === verdict);
        if (!items.length) return null;
        return (
          <Section
            key={verdict}
            title={
              <span className="flex items-center gap-2">
                {verdict === "never" ? "Czarna lista" : VERDICT_LABEL[verdict]}
                <Pill tone={VERDICT_TONE[verdict]}>{items.length}</Pill>
              </span>
            }
          >
            {items.map((v) => (
              <VenueRow key={v.id} v={v} />
            ))}
          </Section>
        );
      })}
    </>
  );
}
