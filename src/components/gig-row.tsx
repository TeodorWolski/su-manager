import { GIG_CONTEXT_LABEL, GIG_STATUS_LABEL, GIG_STATUS_TONE } from "@/lib/labels";
import type { GigListItem } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import { Pill, Rating, Row } from "./ios";

export function GigRow({ gig, showStatus }: { gig: GigListItem; showStatus?: boolean }) {
  const where = [gig.venueName, gig.cityName].filter(Boolean).join(", ");
  const extra = gig.headlinerName ? `przed ${gig.headlinerName}` : gig.context ? GIG_CONTEXT_LABEL[gig.context] : null;
  return (
    <Row
      href={`/gigs/${gig.id}`}
      title={gig.title}
      subtitle={[fmtDateTime(gig.startsAt), where, extra].filter(Boolean).join(" · ")}
      detail={
        gig.rating != null ? (
          <Rating value={gig.rating} />
        ) : showStatus ? (
          <Pill tone={GIG_STATUS_TONE[gig.status]}>{GIG_STATUS_LABEL[gig.status]}</Pill>
        ) : null
      }
    />
  );
}
