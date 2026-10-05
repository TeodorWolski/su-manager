import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";
import { GIG_CONTEXT_LABEL, GIG_STATUS_LABEL, GIG_STATUS_TONE } from "@/lib/labels";
import type { GigListItem } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Pill, Rating } from "./ios";

/** Kartka z kalendarza: dzień dużą cyfrą, miesiąc drobno pod spodem. */
function DateBlock({ startsAt }: { startsAt: string }) {
  const d = parseISO(startsAt);
  return (
    <div className="w-10 shrink-0 text-center leading-none">
      <div className="text-[19px] font-semibold tracking-[-0.02em]">{format(d, "d")}</div>
      <div className="text-muted-foreground mt-1 text-[10px] font-medium tracking-[0.08em] uppercase">
        {format(d, "LLL", { locale: pl })}
      </div>
    </div>
  );
}

export function GigRow({ gig, showStatus }: { gig: GigListItem; showStatus?: boolean }) {
  const when = gig.startsAt.length > 10 ? format(parseISO(gig.startsAt), "EEE HH:mm", { locale: pl }) : format(parseISO(gig.startsAt), "EEE", { locale: pl });
  const where = gig.cityName ?? gig.venueName;
  const extra = gig.headlinerName ? `przed ${gig.headlinerName}` : gig.context ? GIG_CONTEXT_LABEL[gig.context] : null;
  return (
    <Link
      href={`/gigs/${gig.id}`}
      className={cn(
        "flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 active:bg-muted",
        "[&:not(:last-child)]:border-border [&:not(:last-child)]:border-b",
      )}
    >
      <DateBlock startsAt={gig.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[14.5px] leading-snug font-medium">{gig.title}</div>
        <div className="text-muted-foreground truncate text-[12.5px]">{[when, where, extra].filter(Boolean).join(" · ")}</div>
      </div>
      {gig.rating != null ? (
        <Rating value={gig.rating} />
      ) : showStatus ? (
        <Pill tone={GIG_STATUS_TONE[gig.status]}>{GIG_STATUS_LABEL[gig.status].toLowerCase()}</Pill>
      ) : null}
    </Link>
  );
}
