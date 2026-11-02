import Link from "next/link";
import { GIG_CONTEXT_LABEL } from "@/lib/labels";
import type { getStageCard } from "@/lib/queries";
import { proposeSet, SET_MINUTES_BY_CONTEXT } from "@/lib/set-plan";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";

type Data = NonNullable<Awaited<ReturnType<typeof getStageCard>>>;

const ROLE_STYLE = {
  otwarcie: "text-st-ok",
  test: "text-st-wai",
  środek: "text-muted-foreground",
  zamknięcie: "text-st-ok",
} as const;

/**
 * „Przed wyjściem na scenę” — na Dziś w dniu grania: ile minut, propozycja setu z bitów, notatka
 * z poprzedniego razu na tej scenie i pociąg (wagon, miejsce). Logika setu: src/lib/set-plan.ts.
 */
export function StageCard({ data }: { data: Data }) {
  const { gig, lastHere, bits, trips } = data;
  // Minuty: tyle, ile było dostępne ostatnio na tej scenie; inaczej typowo dla typu grania.
  const target = lastHere?.minutesAvailable ?? SET_MINUTES_BY_CONTEXT[gig.context ?? "other"];
  const set = proposeSet(bits, target);
  const time = gig.startsAt.length > 10 ? gig.startsAt.slice(11, 16) : null;
  const where = [gig.venueName, gig.cityName].filter(Boolean).join(", ");

  return (
    <div className="bg-card border-primary/40 mb-7 rounded-[14px] border-2 p-4">
      <div className="text-primary text-[12px] font-semibold tracking-wide uppercase">Dziś na scenie{time && ` · ${time}`}</div>
      <Link href={`/gigs/${gig.id}`} className="mt-1 block text-[19px] leading-tight font-semibold hover:underline">
        {gig.title}
      </Link>
      <div className="text-muted-foreground mt-0.5 text-[13px]">
        {[where, gig.context && GIG_CONTEXT_LABEL[gig.context], gig.headlinerName && `przed ${gig.headlinerName}`].filter(Boolean).join(" · ")}
      </div>

      {trips.length > 0 && (
        <div className="mt-3 space-y-1">
          {trips.map((t) => (
            <div key={t.id} className="bg-muted/60 rounded-lg px-3 py-2 text-[13.5px]">
              🚆 {t.departsAt.slice(11, 16)} {t.fromStation} → {t.toStation}
              {t.arrivesAt && ` (${t.arrivesAt.slice(11, 16)})`}
              {(t.train || t.seat) && <span className="text-muted-foreground"> · {[t.train, t.seat].filter(Boolean).join(" · ")}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="border-border/70 mt-3.5 border-t pt-3">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-semibold">Propozycja setu</span>
          <span className="text-muted-foreground tabular-nums">
            ~{set.totalMin} / {set.targetMin} min
            {lastHere?.minutesAvailable == null && " (typowo)"}
          </span>
        </div>
        {set.items.length ? (
          <ol className="mt-1.5 space-y-1">
            {set.items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-2 text-[15px]">
                <span className={cn("w-[5.5rem] shrink-0 text-[11.5px] font-medium", ROLE_STYLE[i.role])}>{i.role}</span>
                <Link href={`/bits/${i.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {i.name}
                </Link>
                <span className="text-muted-foreground shrink-0 text-[12px] tabular-nums">
                  {i.guessed ? "~" : ""}
                  {i.minutes} min
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground mt-1.5 text-[14px]">Brak bitów w testach ani sprawdzonych — dodaj je w Materiale.</p>
        )}
        <p className="text-muted-foreground mt-1.5 text-[12px]">Mocne na otwarcie i zamknięcie, w środku jeden do przetestowania. Tylko podpowiedź.</p>
      </div>

      {lastHere && (
        <div className="border-border/70 mt-3 border-t pt-3 text-[14px]">
          <div className="text-muted-foreground text-[12px]">
            Ostatnio tutaj {fmtDate(lastHere.startsAt.slice(0, 10))} · ★ {lastHere.rating}
            {lastHere.minutesPlayed != null && ` · zagrałeś ${lastHere.minutesPlayed}${lastHere.minutesAvailable ? `/${lastHere.minutesAvailable}` : ""} min`}
          </div>
          {lastHere.thoughts && <p className="mt-1 leading-snug whitespace-pre-wrap">{lastHere.thoughts}</p>}
        </div>
      )}
    </div>
  );
}
