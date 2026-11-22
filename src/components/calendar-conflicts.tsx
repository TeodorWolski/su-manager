import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { describeWindow } from "@/lib/away";
import type { GigConflict } from "@/lib/calendar-data";
import { fmtDateTime } from "@/lib/time";
import { Section } from "./ios";

/** Dziś: grania (potwierdzone i prośby), na które nachodzi coś z prywatnego kalendarza — wieczór albo cały wyjazd. */
export function CalendarConflicts({ items }: { items: GigConflict[] }) {
  if (!items.length) return null;
  return (
    <Section
      title={
        <span className="text-st-wai flex items-center gap-1">
          <TriangleAlert className="size-3.5" /> Kolizje z kalendarzem
        </span>
      }
      footer="Spotkanie w czasie grania albo wyjazdu na nie. Przełóż je, albo odpuść granie — zanim ktoś na Ciebie policzy."
    >
      {items.map((c) => (
        <Link
          key={c.gig.id}
          href={`/gigs/${c.gig.id}`}
          className="border-border/70 hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors [&:not(:last-child)]:border-b"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-snug font-medium">
              {c.gig.title}
              {c.gig.status !== "confirmed" && <span className="text-muted-foreground font-normal"> · w toku</span>}
            </div>
            <div className="text-muted-foreground mt-0.5 text-[12.5px]">
              {fmtDateTime(c.gig.startsAt)} · {describeWindow(c.window, c.gig.cityName)}
            </div>
            <div className="text-st-wai mt-0.5 text-[13px]">📅 {c.slots.join(", ")}</div>
          </div>
          <ChevronRight className="text-muted-foreground/40 size-4 shrink-0" />
        </Link>
      ))}
    </Section>
  );
}
