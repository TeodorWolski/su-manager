import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { setCalendarRoutine } from "@/app/actions";
import { describeWindow } from "@/lib/away";
import type { GigConflict } from "@/lib/calendar-data";
import type { CalendarSlot } from "@/lib/calendar-sync";
import { fmtDateTime } from "@/lib/time";
import { PendingButton } from "./form";
import { Section } from "./ios";

/** Spotkania z kalendarza w oknie grania; przy każdym „to rutyna” — wpis przestaje kolidować (wszystkie o tym tytule). */
export function ConflictSlots({ slots }: { slots: CalendarSlot[] }) {
  return (
    <ul className="mt-1 space-y-1">
      {slots.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 flex-1">📅 {s.label}</span>
          {s.title && (
            <form action={setCalendarRoutine.bind(null, s.title, true)}>
              <PendingButton className="text-muted-foreground hover:text-foreground shrink-0 rounded-full border px-2 py-0.5 text-[12px]">to rutyna</PendingButton>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

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
      footer="Spotkanie w czasie grania albo wyjazdu na nie. Przełóż je albo odpuść granie. Stały wpis typu siłownia? „To rutyna” — przestanie kolidować."
    >
      {items.map((c) => (
        <div key={c.gig.id} className="border-border/70 px-4 py-3 has-[[data-pending]]:opacity-50 [&:not(:last-child)]:border-b">
          <Link href={`/gigs/${c.gig.id}`} className="group flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] leading-snug font-medium group-hover:underline">
                {c.gig.title}
                {c.gig.status !== "confirmed" && <span className="text-muted-foreground font-normal"> · w toku</span>}
              </div>
              <div className="text-muted-foreground mt-0.5 text-[12.5px]">
                {fmtDateTime(c.gig.startsAt)} · {describeWindow(c.window, c.gig.cityName)}
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/40 size-4 shrink-0" />
          </Link>
          <div className="text-st-wai">
            <ConflictSlots slots={c.slots} />
          </div>
        </div>
      ))}
    </Section>
  );
}
