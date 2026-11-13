import { ChevronDown, ExternalLink } from "lucide-react";
import { messageFromEvent } from "@/app/actions";
import { pitchMessage } from "@/lib/messages";
import { MessageComposer } from "./message-composer";

export type PitchEvent = {
  eventId: number;
  url: string;
  title: string;
  startsAt: string;
  cityName: string | null;
  isOpenMic: boolean;
  performer: { name: string; contactId: number | null };
};

/** Wiersz okazji z bileterii: tytuł (link), jedna linijka szczegółów, etykiety i rozwijane „Napisz” z gotowym tekstem. */
export function PitchRow({ event: e, meta, children }: { event: PitchEvent; meta: string; children?: React.ReactNode }) {
  return (
    <div className="border-border/70 px-4 py-3 transition-opacity [&:not(:last-child)]:border-b has-[[data-pending]]:pointer-events-none has-[[data-pending]]:opacity-50">
      <a href={e.url} target="_blank" rel="noreferrer" className="group block">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[15.5px] leading-snug font-medium group-hover:underline">{e.title}</span>
          <ExternalLink className="text-muted-foreground/60 mt-1 size-3.5 shrink-0" />
        </div>
        <div className="text-muted-foreground mt-0.5 text-[13px]">{meta}</div>
      </a>
      {children}
      <details className="group/write mt-2">
        <summary className="text-primary flex w-fit cursor-pointer list-none items-center gap-1 text-[14px] [&::-webkit-details-marker]:hidden">
          Napisz <ChevronDown className="size-3.5 transition-transform group-open/write:rotate-180" />
        </summary>
        <div className="bg-muted mt-2 rounded-xl p-2">
          <MessageComposer
            message={pitchMessage({ startsAt: e.startsAt, cityName: e.cityName, openMic: e.isOpenMic })}
            action={messageFromEvent}
            hidden={{ eventId: e.eventId, contactId: e.performer.contactId, name: e.performer.name }}
          />
        </div>
      </details>
    </div>
  );
}
