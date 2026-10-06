import { ChevronDown, ExternalLink, Flame } from "lucide-react";
import { messageFromEvent } from "@/app/actions";
import { HOT_FROM_DAYS, HOT_TO_DAYS, type Hot } from "@/lib/hot";
import { pitchMessage } from "@/lib/messages";
import { fmtDateTime, fmtTravel } from "@/lib/time";
import { Pill, Section } from "./ios";
import { MessageComposer } from "./message-composer";

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
        <div
          key={h.eventId}
          className="border-border/70 px-4 py-3 transition-opacity [&:not(:last-child)]:border-b has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50"
        >
          <a href={h.url} target="_blank" rel="noreferrer" className="group block">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-[15.5px] leading-snug font-medium group-hover:underline">{h.title}</span>
              <ExternalLink className="text-muted-foreground/60 mt-1 size-3.5 shrink-0" />
            </div>
            <div className="text-muted-foreground mt-0.5 text-[13px]">
              {[fmtDateTime(h.startsAt), [h.venueName, h.cityName].filter(Boolean).join(", "), fmtTravel(h.travelMinutes)]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </a>
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
          <details className="group/write mt-2">
            <summary className="text-primary flex w-fit cursor-pointer list-none items-center gap-1 text-[14px] [&::-webkit-details-marker]:hidden">
              Napisz <ChevronDown className="size-3.5 transition-transform group-open/write:rotate-180" />
            </summary>
            <div className="bg-muted mt-2 rounded-xl p-2">
              <MessageComposer
                message={pitchMessage({ startsAt: h.startsAt, cityName: h.cityName, openMic: h.isOpenMic })}
                action={messageFromEvent}
                hidden={{ eventId: h.eventId, contactId: h.performer.contactId, name: h.performer.name }}
              />
            </div>
          </details>
        </div>
      ))}
    </Section>
  );
}
