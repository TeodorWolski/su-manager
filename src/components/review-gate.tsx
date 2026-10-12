import { PendingButton } from "@/components/form";
import { markGigCancelled } from "@/app/actions";
import type { FormOptions, GigListItem } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import { LogForm } from "./log-form";

/**
 * Pełnoekranowy formularz oceny grania — jak ocena przejazdu w Uberze/Bolcie.
 * Zasłania aplikację, dopóki każde minione potwierdzone granie nie ma logu.
 * Jedyna ucieczka: „nie zagrałem” (status → odwołane).
 */
export function ReviewGate({
  gig,
  remaining,
  options,
}: {
  gig: GigListItem;
  remaining: number;
  options: FormOptions;
}) {
  const cancel = markGigCancelled.bind(null, gig.id);
  return (
    <div className="bg-background fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-lg px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="text-muted-foreground text-[13px] font-medium">
          Jak wypadło granie?{remaining > 1 && ` · jeszcze ${remaining - 1}`}
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight text-balance">{gig.title}</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-[15px]">
          {fmtDateTime(gig.startsAt)}
          {gig.venueName && ` · ${gig.venueName}`}
          {gig.cityName && `, ${gig.cityName}`}
        </p>

        <LogForm
          key={gig.id}
          gigId={gig.id}
          title={gig.title}
          options={options}
          defaults={{ context: gig.context, headlinerId: gig.headlinerId }}
          returnTo="/"
        />

        <form action={cancel} className="pb-10 text-center">
          <PendingButton className="text-muted-foreground text-[15px] underline-offset-4 hover:underline">
            Nie zagrałem — granie się nie odbyło
          </PendingButton>
        </form>
      </div>
    </div>
  );
}
