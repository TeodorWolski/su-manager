import Link from "next/link";
import { deleteTrip } from "@/app/actions";
import { fmtZl } from "@/lib/ticket-parse";
import { PendingButton } from "./form";

type Trip = {
  id: number;
  fromStation: string;
  toStation: string;
  departsAt: string;
  arrivesAt: string | null;
  train: string | null;
  seat: string | null;
  priceGr: number | null;
  url: string | null;
  gigId?: number | null;
  gigTitle?: string | null;
};

const hm = (iso: string | null) => (iso && iso.length > 10 ? iso.slice(11, 16) : "");
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** 🚆 Słupsk → Warszawa Centralna · 05.11 07:16–11:31 · EIP 8300 · wagon 4, miejsce 82 · 88,41 zł */
export function TripRow({ trip: t, showGig }: { trip: Trip; showGig?: boolean }) {
  return (
    <div className="border-border/70 flex items-start gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b has-[[data-pending]]:opacity-50">
      <span className="pt-0.5 text-[16px]" aria-hidden>
        🚆
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]">
          {t.fromStation} → {t.toStation}
        </div>
        <div className="text-muted-foreground text-[12.5px]">
          {[`${dm(t.departsAt)} ${hm(t.departsAt)}${t.arrivesAt ? `–${hm(t.arrivesAt)}` : ""}`, t.train, t.seat].filter(Boolean).join(" · ")}
        </div>
        {showGig && (
          <div className="text-[12.5px]">
            {t.gigId ? (
              <Link href={`/gigs/${t.gigId}`} className="text-primary">
                na: {t.gigTitle}
              </Link>
            ) : (
              <span className="text-muted-foreground">prywatna</span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {t.priceGr != null && <span className="text-[14px] font-semibold tabular-nums">{fmtZl(t.priceGr)}</span>}
        <div className="flex items-center gap-1">
          {t.url && (
            <a href={t.url} target="_blank" rel="noreferrer" className="text-primary text-[12.5px]">
              bilet
            </a>
          )}
          <form action={deleteTrip.bind(null, t.id)}>
            <PendingButton className="text-muted-foreground/60 hover:text-destructive px-1 text-lg leading-none" aria-label="Usuń podróż">
              ×
            </PendingButton>
          </form>
        </div>
      </div>
    </div>
  );
}
