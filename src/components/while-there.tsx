import { ChevronRight, TrainFront } from "lucide-react";
import Link from "next/link";
import type { WhileThere as Stays } from "@/lib/planning";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { WHILE_THERE_RADIUS_KM } from "@/lib/while-there";
import { Pill, Section } from "./ios";
import { PitchRow } from "./pitch-row";

const period = (from: string, to: string) => (from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`);

/** „Skoro już jedziesz”: przy pobycie poza domem (granie albo prywatna podróż) — co jeszcze gra w okolicy. */
export function WhileThere({ stays }: { stays: Stays }) {
  if (!stays.length) return null;
  return (
    <>
      {stays.map(({ stay, items, total }) => (
        <Section
          key={`${stay.city}-${stay.from}`}
          title={
            <span className="flex items-center gap-1">
              <TrainFront className="size-3.5" /> Skoro już jedziesz · {stay.city}
            </span>
          }
          footer={`${period(stay.from, stay.to)}${stay.gigs.length ? ` · przy: ${stay.gigs.map((g) => g.title).join(", ")}` : " · prywatna podróż"}. Do ${WHILE_THERE_RADIUS_KM} km, w dni bez Twojego grania.`}
        >
          {items.map((o) => (
            <PitchRow
              key={o.eventId}
              event={o}
              meta={[fmtDateTime(o.startsAt), [o.venueName, o.cityName].filter(Boolean).join(", "), o.distanceKm > 0 && `${o.distanceKm} km`].filter(Boolean).join(" · ")}
            >
              {(o.friend || o.isOpenMic) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {o.friend && <Pill tone="success">{o.friend}</Pill>}
                  {o.isOpenMic && <Pill tone="neutral">open mic</Pill>}
                </div>
              )}
            </PitchRow>
          ))}
          {total > items.length && (
            <Link
              href={`/events?${new URLSearchParams({ near: stay.city, d: stay.gigs[0]?.startsAt.slice(0, 10) ?? stay.from, r: String(WHILE_THERE_RADIUS_KM), span: "1" })}`}
              className="text-primary flex items-center px-4 py-3 text-[14px]"
            >
              Wszystkie w okolicy ({total}) <ChevronRight className="size-3.5" />
            </Link>
          )}
        </Section>
      ))}
    </>
  );
}
