import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";
import { PageHeader } from "@/components/ios";
import { getWritingReport } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { writingReport } from "@/lib/writing-report";

const PERIODS = [7, 28] as const;

/** Raport pracy nad materiałem gotowy do wklejenia w rozmowę z Claude. */
export default async function WritingReportPage({ searchParams }: PageProps<"/writing/report">) {
  const { d } = await searchParams;
  const days = PERIODS.find((p) => String(p) === d) ?? 28;
  const text = writingReport(await getWritingReport(days));
  return (
    <>
      <PageHeader title="Raport do Claude" back={{ href: "/writing", label: "Pisanie" }} subtitle="Skopiuj i wklej w nową rozmowę" />
      <div className="mb-3 flex gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/writing/report?d=${p}`}
            className={cn("rounded-full px-3 py-1.5 text-[13px] font-medium", p === days ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
          >
            {p === 7 ? "Ostatni tydzień" : "Ostatnie 4 tygodnie"}
          </Link>
        ))}
      </div>
      <div className="mb-7">
        <CopyBlock text={text} />
      </div>
    </>
  );
}
