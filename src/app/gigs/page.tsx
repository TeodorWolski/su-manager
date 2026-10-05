import { Plus } from "lucide-react";
import Link from "next/link";
import { GigRow } from "@/components/gig-row";
import { Empty, PageHeader, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { listGigs } from "@/lib/queries";
import { cn } from "@/lib/utils";

const VIEWS = {
  upcoming: "Nadchodzące",
  pipeline: "W toku",
  past: "Zagrane",
  all: "Wszystkie",
} as const;
type View = keyof typeof VIEWS;

export default async function GigsPage({ searchParams }: PageProps<"/gigs">) {
  const { view: raw } = await searchParams;
  const view: View = typeof raw === "string" && raw in VIEWS ? (raw as View) : "upcoming";
  const items = await listGigs(view);

  return (
    <>
      <PageHeader
        title="Grania"
        action={
          <Button asChild size="icon-lg" className="rounded-full">
            <Link href="/gigs/new" aria-label="Nowe granie">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      <div className="bg-muted mb-5 grid grid-cols-4 gap-1 rounded-xl p-1">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={v === "upcoming" ? "/gigs" : `/gigs?view=${v}`}
            className={cn(
              "flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-all sm:text-[14px]",
              v === view ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </div>
      <Section>
        {items.length ? (
          items.map((g) => <GigRow key={g.id} gig={g} showStatus={view !== "upcoming"} />)
        ) : (
          <Empty>Nic tu jeszcze nie ma.</Empty>
        )}
      </Section>
    </>
  );
}
