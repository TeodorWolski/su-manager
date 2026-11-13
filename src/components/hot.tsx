import { Flame } from "lucide-react";
import { HOT_FROM_DAYS, HOT_TO_DAYS, type Hot } from "@/lib/hot";
import { fmtDateTime, fmtTravel } from "@/lib/time";
import { Pill, Section } from "./ios";
import { PitchRow } from "./pitch-row";

/** Ekran Dziś: kilka najlepszych okazji za 1–3 tygodnie, z gotową wiadomością. */
export function HotOpportunities({ items }: { items: Hot[] }) {
  if (!items.length) return null;
  return (
    <Section
      title={
        <span className="flex items-center gap-1">
          <Flame className="size-3.5" /> Najgorętsze okazje
        </span>
      }
      footer={`Za ${Math.round(HOT_FROM_DAYS / 7)}–${Math.round(HOT_TO_DAYS / 7)} tygodnie — w sam raz, żeby zaklepać miejsce. Bez tygodni pełnych, serii i trzeciego grania przed komikiem.`}
    >
      {items.map((h) => (
        <PitchRow
          key={h.eventId}
          event={h}
          meta={[fmtDateTime(h.startsAt), [h.venueName, h.cityName].filter(Boolean).join(", "), fmtTravel(h.travelMinutes)].filter(Boolean).join(" · ")}
        >
          {(h.friend || h.reasons.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {h.friend && <Pill tone="success">{h.friend}</Pill>}
              {h.reasons
                .filter((r) => r !== "znajomy")
                .map((r) => (
                  <Pill key={r} tone={r === "sold out" || r === "ostatnie bilety" ? "warning" : "neutral"}>
                    {r}
                  </Pill>
                ))}
            </div>
          )}
        </PitchRow>
      ))}
    </Section>
  );
}
