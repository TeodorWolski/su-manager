"use client";

import { useState, useSyncExternalStore } from "react";
import { saveLog } from "@/app/actions";
import type { GigContext } from "@/db/schema";
import { GIG_CONTEXT_LABEL, REACTIONS } from "@/lib/labels";
import { isNetworkError, queuedLogs, queueLog } from "@/lib/offline-log";
import type { FormOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { FieldRow, NumberInput, SelectOrNew, SubmitButton, TextArea } from "./form";

const RATING_HINT = ["", "Zabiłem się", "Słabo", "OK", "Dobrze", "Rozwaliłem"];
const VENUE_HINT = ["", "Dramat", "Słabo", "OK", "Dobre", "Świetne"];

/** Pięć przycisków 1–5. Ponowny tap w wybraną wartość czyści ją, gdy ocena jest opcjonalna. */
function RatingPicker({
  value,
  onChange,
  hints,
  size = "lg",
  clearable,
}: {
  value: number;
  onChange: (n: number) => void;
  hints: string[];
  size?: "lg" | "sm";
  clearable?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(clearable && value === n ? 0 : n)}
            className={cn(
              "font-bold tabular-nums transition-all active:scale-95",
              size === "lg" ? "aspect-square rounded-2xl text-[26px]" : "h-11 rounded-xl text-[18px]",
              value === n
                ? "bg-primary text-primary-foreground shadow-primary/30 shadow-lg"
                : value > n
                  ? "bg-primary/20 text-primary"
                  : "bg-card text-muted-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 h-5 text-center text-[15px]">{hints[value]}</p>
    </div>
  );
}

export type LogDefaults = {
  rating?: number | null;
  venueRating?: number | null;
  attendance?: number | null;
  minutesPlayed?: number | null;
  minutesAvailable?: number | null;
  thoughts?: string | null;
  context?: GigContext | null;
  headlinerId?: number | null;
  bitIds?: number[];
  /** Zapisane reakcje na bity: bitId → 1 / 0 / -1. */
  reactions?: Record<number, number | null>;
};

const subscribeQueue = (cb: () => void) => {
  window.addEventListener("su-log-queue", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("su-log-queue", cb);
    window.removeEventListener("storage", cb);
  };
};

export function LogForm({
  gigId,
  title,
  options,
  defaults = {},
  returnTo,
}: {
  gigId: number;
  /** Do kolejki offline („czeka na wysłanie: …”). */
  title: string;
  options: Pick<FormOptions, "bits" | "contacts">;
  defaults?: LogDefaults;
  returnTo?: string;
}) {
  // Bez zasięgu (piwnica klubu) log ląduje w telefonie i OfflineSync wyśle go, gdy sieć wróci.
  const queued = useSyncExternalStore(
    subscribeQueue,
    () => queuedLogs().some((q) => q.gigId === gigId),
    () => false,
  );
  async function submit(fd: FormData) {
    if (!navigator.onLine) return queueLog(fd, title);
    try {
      await saveLog(fd);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      queueLog(fd, title);
    }
  }
  const [rating, setRating] = useState(defaults.rating ?? 0);
  const [venueRating, setVenueRating] = useState(defaults.venueRating ?? 0);
  const [context, setContext] = useState<GigContext | "">(defaults.context ?? "");
  const [picked, setPicked] = useState(new Set(defaults.bitIds ?? []));
  const [reactions, setReactions] = useState<Record<number, number | null>>(defaults.reactions ?? {});
  // Odrzucone bity znikają z wyboru — chyba że były już zapisane w tym logu.
  const bits = options.bits.filter((b) => b.status !== "rejected" || defaults.bitIds?.includes(b.id));

  const toggleBit = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickedMinutes = bits
    .filter((b) => picked.has(b.id))
    .reduce((sum, b) => sum + (b.lengthMin ?? 0), 0);

  return (
    <form action={submit} className="space-y-6">
      <input type="hidden" name="gigId" value={gigId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <input type="hidden" name="venueRating" value={venueRating || ""} />
      <input type="hidden" name="context" value={context} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {/* 1. Jak mi poszło — jeden tap */}
      <div>
        <div className="text-muted-foreground mb-1.5 px-1 text-[12.5px] font-medium">Jak mi poszło</div>
        <RatingPicker value={rating} onChange={setRating} hints={RATING_HINT} />
      </div>

      {/* 2. Myśli na gorąco — najważniejsze pole */}
      <div className="bg-card rounded-2xl px-4 py-3">
        <div className="text-muted-foreground mb-1 text-[13px]">Myśli na gorąco</div>
        <TextArea
          name="thoughts"
          defaultValue={defaults.thoughts ?? ""}
          placeholder="Co zadziałało, co nie, co zmienić, kto był na sali…"
          className="min-h-40"
        />
      </div>

      {/* 3. Miejsce — osobno od występu */}
      <div>
        <div className="text-muted-foreground mb-1.5 px-1 text-[12.5px] font-medium">
          Miejsce <span className="normal-case">· sala, publika, organizacja</span>
        </div>
        <RatingPicker value={venueRating} onChange={setVenueRating} hints={VENUE_HINT} size="sm" clearable />
      </div>

      {/* 4. Liczby */}
      <div className="bg-card overflow-hidden rounded-2xl">
        <FieldRow label="Frekwencja">
          <NumberInput name="attendance" defaultValue={defaults.attendance ?? ""} placeholder="osób" />
        </FieldRow>
        <FieldRow label="Zagrane min">
          <NumberInput
            name="minutesPlayed"
            defaultValue={defaults.minutesPlayed ?? ""}
            placeholder={pickedMinutes ? `~${pickedMinutes}` : "min"}
          />
        </FieldRow>
        <FieldRow label="Dostępne min">
          <NumberInput name="minutesAvailable" defaultValue={defaults.minutesAvailable ?? ""} placeholder="min" />
        </FieldRow>
      </div>

      {/* 5. Kontekst */}
      <div>
        <div className="text-muted-foreground mb-1.5 px-1 text-[12.5px] font-medium">Kontekst</div>
        <div className="bg-muted grid grid-cols-5 gap-1 rounded-xl p-1">
          {(Object.keys(GIG_CONTEXT_LABEL) as GigContext[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setContext(context === c ? "" : c)}
              className={cn(
                "h-9 rounded-lg text-[12.5px] font-medium transition-all sm:text-[14px]",
                context === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {GIG_CONTEXT_LABEL[c]}
            </button>
          ))}
        </div>
        {(context === "opener" || context === "support") && (
          <div className="bg-card mt-2 overflow-hidden rounded-2xl">
            <FieldRow label="Przed kim">
              <SelectOrNew
                name="headlinerId"
                newName="headlinerName"
                defaultValue={defaults.headlinerId}
                newPlaceholder="imię i nazwisko"
                options={options.contacts.filter((c) => c.role === "comedian").map((c) => ({ value: c.id, label: c.name }))}
              />
            </FieldRow>
          </div>
        )}
      </div>

      {/* 6. Bity */}
      <div>
        <div className="mb-1.5 flex justify-between px-1 text-[12.5px] font-medium">
          <span className="text-muted-foreground">Zagrane bity</span>
          {picked.size > 0 && <span className="text-foreground">{picked.size} · ~{pickedMinutes} min</span>}
        </div>
        {bits.length === 0 ? (
          <p className="text-muted-foreground px-4 text-[15px]">Dodaj bity w zakładce Materiał — tu pojawią się do wyboru.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bits.map((b) => (
              <label
                key={b.id}
                className={cn(
                  "cursor-pointer rounded-full px-3.5 py-2 text-[15px] transition-all select-none active:scale-95",
                  picked.has(b.id) ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
                )}
              >
                <input
                  type="checkbox"
                  name="bits"
                  value={b.id}
                  checked={picked.has(b.id)}
                  onChange={() => toggleBit(b.id)}
                  className="sr-only"
                />
                {b.name}
              </label>
            ))}
          </div>
        )}
        {picked.size > 0 && (
          <div className="bg-card mt-3 overflow-hidden rounded-2xl">
            {bits
              .filter((b) => picked.has(b.id))
              .map((b) => (
                <div key={b.id} className="border-border/70 flex items-center gap-2 px-4 py-1.5 [&:not(:last-child)]:border-b">
                  <span className="min-w-0 flex-1 truncate text-[15px]">{b.name}</span>
                  <input type="hidden" name={`reaction-${b.id}`} value={reactions[b.id] ?? ""} />
                  {REACTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      aria-label={r.label}
                      aria-pressed={reactions[b.id] === r.value}
                      onClick={() => setReactions((prev) => ({ ...prev, [b.id]: prev[b.id] === r.value ? null : r.value }))}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg text-[18px] transition-all active:scale-90",
                        reactions[b.id] === r.value ? "bg-primary/20 ring-primary/50 ring-1" : "opacity-40 grayscale",
                      )}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="bg-background/80 sticky bottom-0 -mx-4 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {queued && (
          <p className="bg-st-wai/15 mb-2 rounded-xl px-3 py-2 text-[14px] leading-snug">
            📴 Brak zasięgu — log zapisany w telefonie. Wyślę go sam, jak wróci sieć (możesz zamknąć apkę).
          </p>
        )}
        {rating === 0 ? (
          <div className="text-muted-foreground flex h-12 items-center justify-center text-[15px]">Oceń, jak Ci poszło (1–5)</div>
        ) : (
          <SubmitButton>{queued ? "Zapisz ponownie" : "Zapisz"}</SubmitButton>
        )}
      </div>
    </form>
  );
}
