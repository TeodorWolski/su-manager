"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveTrip, tripImportContext } from "@/app/actions";
import { FieldRow, Select, SubmitButton, TextArea, TextInput } from "@/components/form";
import { fmtZl, missingFields, parseTicket, type ParsedTicket } from "@/lib/ticket-parse";

/** Bilet czekający na zalogowanie (Safari bez sesji) — po powrocie z /login wraca z localStorage. */
const PENDING_KEY = "su-trip-import";

type Payload = { u: string | null; t: string };
type Context = Awaited<ReturnType<typeof tripImportContext>>;

function readPayload(): Payload | null {
  try {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      // Skrót ze strony / bookmarklet przysyłają {"u": adres, "t": tekst strony}; skrót z PDF-a — sam tekst.
      const p = hash.startsWith("{") ? (JSON.parse(hash) as Payload) : { u: null, t: hash };
      localStorage.setItem(PENDING_KEY, JSON.stringify(p));
      history.replaceState(null, "", location.pathname);
      return p;
    }
    const saved = localStorage.getItem(PENDING_KEY);
    return saved ? (JSON.parse(saved) as Payload) : null;
  } catch {
    return null;
  }
}

const zl = (gr: number | null) => (gr == null ? "" : (gr / 100).toFixed(2).replace(".", ","));

export function TripImport() {
  const [ticket, setTicket] = useState<ParsedTicket | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pasted, setPasted] = useState("");

  function load(p: Payload) {
    const t = parseTicket(p.t, p.u);
    setTicket(t);
    if (!t.fromStation || !t.toStation || !t.departsAt) return;
    tripImportContext({ fromStation: t.fromStation, toStation: t.toStation, departsAt: t.departsAt, arrivesAt: t.arrivesAt, reference: t.reference })
      .then(setCtx)
      .catch(() => setNeedsLogin(true));
  }

  useEffect(() => {
    const p = readPayload();
    // Odczyt adresu / localStorage jest tylko w przeglądarce — stąd efekt, a nie stan początkowy.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p) load(p);
  }, []);

  if (!ticket) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          Wklej tekst ze strony albo z PDF-a biletu (zaznacz wszystko → kopiuj) albo użyj „Udostępnij → Dodaj do SU Manager”.{" "}
          <Link href="/trips/setup" className="text-primary">
            Jak to ustawić?
          </Link>
        </p>
        <TextArea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Tekst biletu…" className="bg-card min-h-40 rounded-xl p-3" />
        <button
          type="button"
          disabled={!pasted.trim()}
          onClick={() => load({ u: null, t: pasted })}
          className="bg-primary text-primary-foreground h-11 w-full rounded-xl text-[16px] font-semibold disabled:opacity-40"
        >
          Odczytaj bilet
        </button>
      </div>
    );
  }

  const missing = missingFields(ticket);
  return (
    <form
      action={async (fd) => {
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {}
        await saveTrip(fd);
      }}
      className="space-y-4"
    >
      {needsLogin && (
        <div className="bg-st-wai/15 rounded-xl px-3 py-2.5 text-[14px] leading-snug">
          Ta przeglądarka nie jest zalogowana do SU Managera. Bilet poczeka —{" "}
          <Link href="/login?next=/trips/import" className="text-primary font-semibold">
            zaloguj się
          </Link>{" "}
          (Face ID działa) i wrócisz tutaj.
        </div>
      )}
      {ctx?.existing && (
        <div className="bg-muted rounded-xl px-3 py-2.5 text-[14px]">Ten bilet już jest w podróżach — zapis go zaktualizuje.</div>
      )}
      {missing.length > 0 && (
        <div className="bg-st-wai/15 rounded-xl px-3 py-2.5 text-[14px]">Nie wszystko dało się odczytać — uzupełnij puste pola.</div>
      )}

      <div className="bg-card overflow-hidden rounded-2xl">
        <FieldRow label="Skąd">
          <TextInput name="fromStation" required defaultValue={ticket.fromStation ?? ""} />
        </FieldRow>
        <FieldRow label="Dokąd">
          <TextInput name="toStation" required defaultValue={ticket.toStation ?? ""} />
        </FieldRow>
        <FieldRow label="Odjazd">
          <TextInput type="datetime-local" name="departsAt" required defaultValue={ticket.departsAt ?? ""} />
        </FieldRow>
        <FieldRow label="Przyjazd">
          <TextInput type="datetime-local" name="arrivesAt" defaultValue={ticket.arrivesAt ?? ""} />
        </FieldRow>
        <FieldRow label="Cena (zł)">
          <TextInput name="price" inputMode="decimal" placeholder="np. 88,41" defaultValue={zl(ticket.priceGr)} />
        </FieldRow>
        <FieldRow label="Pociąg">
          <TextInput name="train" defaultValue={ticket.train ?? ""} />
        </FieldRow>
        <FieldRow label="Miejsce">
          <TextInput name="seat" defaultValue={ticket.seat ?? ""} />
        </FieldRow>
        <FieldRow label="Przewoźnik">
          <TextInput name="carrier" defaultValue={ticket.carrier ?? ""} />
        </FieldRow>
      </div>

      <div className="bg-card overflow-hidden rounded-2xl">
        <FieldRow label="Na granie">
          <Select
            key={ctx ? "ctx" : "none"}
            name="gigId"
            placeholder="Prywatna podróż"
            defaultValue={ctx?.existing?.gigId ?? ctx?.suggested ?? ""}
            options={(ctx?.gigs ?? []).map((g) => ({
              value: g.id,
              label: `${g.startsAt.slice(8, 10)}.${g.startsAt.slice(5, 7)} · ${g.title}${g.cityName ? ` (${g.cityName})` : ""}`,
            }))}
          />
        </FieldRow>
      </div>
      <p className="text-muted-foreground px-1 text-[13px]">
        {ctx?.suggested ? "Podpowiedziane granie pasuje datą i miastem." : "Prywatna podróż: tylko kalendarz, bez kosztów grań."}
        {ticket.priceGr != null && ` Bilet: ${fmtZl(ticket.priceGr)}.`}
      </p>

      <input type="hidden" name="reference" value={ticket.reference ?? ""} />
      <input type="hidden" name="url" value={ticket.url ?? ""} />
      <SubmitButton>Zapisz podróż</SubmitButton>
    </form>
  );
}
