import { Search } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Rating, Section } from "@/components/ios";
import { listThoughts } from "@/lib/queries";
import { fmtDate } from "@/lib/time";

export default async function ThoughtsPage({ searchParams }: PageProps<"/thoughts">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const items = await listThoughts(query);

  return (
    <>
      <PageHeader title="Myśli" back={{ href: "/more", label: "Więcej" }} />
      <form className="bg-muted mb-5 flex h-10 items-center gap-2 rounded-xl px-3">
        <Search className="text-muted-foreground size-4" />
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Szukaj w notatkach po graniach"
          className="placeholder:text-muted-foreground flex-1 bg-transparent text-[16px] outline-none"
        />
      </form>
      <Section footer={query ? `${items.length} wyników` : undefined}>
        {items.length ? (
          items.map((t) => (
            <Link
              key={t.gigId}
              href={`/gigs/${t.gigId}`}
              className="border-border/70 hover:bg-muted/50 active:bg-muted block px-4 py-3 transition-colors [&:not(:last-child)]:border-b"
            >
              <div className="text-muted-foreground mb-1 flex justify-between text-[13px]">
                <span>
                  {fmtDate(t.startsAt)} · {t.venueName ?? t.title}
                </span>
                <Rating value={t.rating} />
              </div>
              <p className="line-clamp-4 text-[16px] leading-relaxed whitespace-pre-wrap">{t.thoughts}</p>
            </Link>
          ))
        ) : (
          <Empty>{query ? "Nic nie znaleziono." : "Tu pojawią się Twoje notatki po graniach."}</Empty>
        )}
      </Section>
    </>
  );
}
