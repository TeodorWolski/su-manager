import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Miesiące ("YYYY-MM") z liczbą pozycji, posortowane rosnąco albo malejąco. */
export function monthCounts<T>(items: T[], date: (item: T) => string, order: "asc" | "desc" = "asc") {
  const counts = new Map<string, number>();
  for (const item of items) {
    const m = date(item).slice(0, 7);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (order === "asc" ? a.localeCompare(b) : b.localeCompare(a)))
    .map(([month, count]) => ({ month, count }));
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

/**
 * Przewijany pasek miesięcy („Wszystkie · paź · lis …”) — filtr jednym tapnięciem.
 * Rok dopisujemy tylko przy miesiącach spoza bieżącego roku.
 */
export function MonthChips({
  months,
  active,
  href,
  thisYear,
}: {
  months: { month: string; count: number }[];
  active: string | null;
  href: (month: string | null) => string;
  thisYear: string;
}) {
  if (months.length < 2 && !active) return null;
  const chip = (on: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap transition-colors",
      on ? "bg-foreground text-background" : "bg-card text-foreground",
    );
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link href={href(null)} className={chip(!active)} scroll={false}>
        Wszystkie
      </Link>
      {months.map(({ month, count }) => {
        const d = parseISO(`${month}-01`);
        const label = format(d, month.startsWith(thisYear) ? "LLLL" : "LLL yyyy", { locale: pl });
        return (
          <Link key={month} href={href(month)} className={chip(active === month)} scroll={false}>
            <span className="capitalize">{label}</span>
            <span className="text-[12px] font-normal tabular-nums opacity-60">{count}</span>
          </Link>
        );
      })}
    </div>
  );
}
