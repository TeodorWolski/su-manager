"use client";

import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Mini kalendarz obłożenia — pływający przycisk w prawym dolnym rogu, na każdej podstronie.
 * Kolor = typ grania (open mic / przed kimś / support / headline, inne szare), pełne kółko =
 * potwierdzone, obwódka = w toku; po prawej liczba grań w tygodniu względem rytmu 2–3.
 * Otwarty / zamknięty zostaje między stronami (localStorage).
 */
type MonthGig = { id: number; title: string; startsAt: string; status: string; context: string | null; city: string | null };

const STORAGE_KEY = "mini-calendar-open";
const WEEK_MIN = 2;
const WEEK_MAX = 3;
const DAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const PENDING = new Set(["interested", "contacted", "waiting"]);

/**
 * Typ grania → kolor (tokeny --ctx-* w globals.css, paleta sprawdzona walidatorem w obu motywach).
 * `ink` = kolor cyfry na pełnym kółku: na żółtym i turkusowym ciemna (białej nie widać).
 */
const CONTEXT_STYLE: Record<string, { label: string; bg: string; ring: string; dot: string; ink: string }> = {
  open_mic: { label: "Open mic", bg: "bg-ctx-openmic", ring: "ring-ctx-openmic", dot: "bg-ctx-openmic", ink: "text-white" },
  opener: { label: "Przed kimś", bg: "bg-ctx-opener", ring: "ring-ctx-opener", dot: "bg-ctx-opener", ink: "text-white" },
  support: { label: "Support", bg: "bg-ctx-support", ring: "ring-ctx-support", dot: "bg-ctx-support", ink: "text-[#141413]" },
  headline: { label: "Headline", bg: "bg-ctx-headline", ring: "ring-ctx-headline", dot: "bg-ctx-headline", ink: "text-[#141413]" },
};
const OTHER_STYLE = { label: "Inne", bg: "bg-st-int", ring: "ring-st-int", dot: "bg-st-int", ink: "text-white" };
const styleOf = (context: string | null) => (context && CONTEXT_STYLE[context]) || OTHER_STYLE;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Otwarty / zamknięty — w localStorage (per urządzenie, przeżywa nawigację i odświeżenie).
 * Bez dostępu do storage (tryb prywatny) działa z pamięci do końca wizyty.
 */
const OPEN_EVENT = "mini-calendar";
let memoryOpen = false;
const readOpen = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return memoryOpen;
  }
};
const writeOpen = (v: boolean) => {
  memoryOpen = v;
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(OPEN_EVENT));
};
const subscribeOpen = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(OPEN_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(OPEN_EVENT, cb);
  };
};

/** Numer tygodnia ISO 8601 (jak w kalendarzach w Polsce). */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}

/** 6 tygodni od poniedziałku przed 1. dniem miesiąca. */
function gridFor(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export function MiniCalendar() {
  const pathname = usePathname();
  const open = useSyncExternalStore(subscribeOpen, readOpen, () => false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [gigs, setGigs] = useState<MonthGig[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const today = iso(new Date());

  const toggle = writeOpen;

  const weeks = useMemo(() => gridFor(month), [month]);
  const from = iso(weeks[0][0]);
  const to = iso(weeks[5][6]);

  // Odśwież przy otwarciu, zmianie miesiąca i przejściu na inną stronę (np. po dodaniu grania).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/month?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: MonthGig[]) => !cancelled && setGigs(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, from, to, pathname]);

  const byDay = useMemo(() => {
    const m = new Map<string, MonthGig[]>();
    for (const g of gigs) m.set(g.startsAt.slice(0, 10), [...(m.get(g.startsAt.slice(0, 10)) ?? []), g]);
    return m;
  }, [gigs]);

  const shift = (n: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
    setSelected(null);
  };
  const dayGigs = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <>
      {open && (
        <div
          className={cn(
            "bg-card border-border fixed right-3 z-40 w-[min(320px,calc(100vw-24px))] rounded-2xl border p-3 shadow-xl",
            "bottom-[calc(env(safe-area-inset-bottom)+124px)] md:bottom-20",
          )}
          role="dialog"
          aria-label="Mini kalendarz"
        >
          <div className="mb-2 flex items-center gap-1">
            <button onClick={() => shift(-1)} className="hover:bg-muted rounded-lg p-1.5" aria-label="Poprzedni miesiąc">
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="flex-1 text-center text-[15px] font-semibold capitalize"
              title="Wróć do bieżącego miesiąca"
            >
              {format(month, "LLLL yyyy", { locale: pl })}
            </button>
            <button onClick={() => shift(1)} className="hover:bg-muted rounded-lg p-1.5" aria-label="Następny miesiąc">
              <ChevronRight className="size-4" />
            </button>
            <button onClick={() => toggle(false)} className="text-muted-foreground hover:bg-muted ml-1 rounded-lg p-1.5" aria-label="Zamknij">
              <X className="size-4" />
            </button>
          </div>

          <div className="text-muted-foreground grid grid-cols-[1.4rem_repeat(7,1fr)_1.4rem] gap-y-1 text-center text-[10.5px] font-medium">
            <span />
            {DAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
            <span title="Grania w tygodniu">Σ</span>
          </div>

          <div className="mt-1 space-y-0.5">
            {weeks.map((week) => {
              const count = week.reduce((s, d) => s + (byDay.get(iso(d))?.length ?? 0), 0);
              const thisWeek = week.some((d) => iso(d) === today);
              return (
                <div
                  key={iso(week[0])}
                  className={cn("grid grid-cols-[1.4rem_repeat(7,1fr)_1.4rem] items-center rounded-lg text-center", thisWeek && "bg-muted/70")}
                >
                  <span className="text-muted-foreground/60 text-[10px] tabular-nums">{isoWeek(week[0])}</span>
                  {week.map((d) => {
                    const key = iso(d);
                    const list = byDay.get(key) ?? [];
                    // Główne granie dnia: potwierdzone ma pierwszeństwo przed tymi w toku.
                    const main = list.find((g) => g.status === "confirmed") ?? list.find((g) => PENDING.has(g.status));
                    const confirmed = main?.status === "confirmed";
                    const pending = !!main && !confirmed;
                    const st = main ? styleOf(main.context) : null;
                    const inMonth = d.getMonth() === month.getMonth();
                    return (
                      <button
                        key={key}
                        onClick={() => setSelected(selected === key ? null : key)}
                        className="flex h-9 items-center justify-center"
                        aria-label={`${format(d, "d MMMM", { locale: pl })}${list.length ? `, ${list.length} grań` : ""}`}
                      >
                        <span
                          className={cn(
                            "relative flex size-8 items-center justify-center rounded-full text-[14px] tabular-nums transition-colors",
                            !inMonth && "text-muted-foreground/40",
                            confirmed && st && cn(st.bg, st.ink, "font-semibold"),
                            pending && st && cn(st.ring, "ring-2 ring-inset font-semibold"),
                            key === today && !confirmed && "text-primary font-bold",
                            key === today && "outline-primary outline-2 outline-offset-1",
                            selected === key && "outline-foreground outline-2 outline-offset-1",
                          )}
                        >
                          {d.getDate()}
                          {/* Kolejne granie tego dnia — kropka w jego kolorze. */}
                          {list.length > 1 && (
                            <span className={cn("ring-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2", styleOf(list.find((g) => g !== main)?.context ?? null).dot)} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      count === 0 ? "text-muted-foreground/40" : count > WEEK_MAX ? "text-st-wai" : count >= WEEK_MIN ? "text-st-ok" : "text-muted-foreground",
                    )}
                  >
                    {count || "·"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px]">
            {[...Object.values(CONTEXT_STYLE), OTHER_STYLE].map((s) => (
              <span key={s.label} className="flex items-center gap-1">
                <span className={cn("size-2.5 rounded-full", s.dot)} /> {s.label}
              </span>
            ))}
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-3 px-1 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="bg-foreground/60 size-2.5 rounded-full" /> potwierdzone
            </span>
            <span className="flex items-center gap-1">
              <span className="ring-foreground/60 size-2.5 rounded-full ring-2 ring-inset" /> w toku
            </span>
            <span className="ml-auto">Σ cel 2–3</span>
          </div>

          {selected && (
            <div className="border-border/70 mt-2 border-t pt-2">
              <div className="text-muted-foreground mb-1 px-1 text-[12px] first-letter:uppercase">{format(parseISO(selected), "EEEE, d MMMM", { locale: pl })}</div>
              {dayGigs.length ? (
                <>
                  {dayGigs.map((g) => (
                  <Link key={g.id} href={`/gigs/${g.id}`} className="hover:bg-muted flex items-center gap-2 rounded-lg px-1 py-1.5 text-[14px]">
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        g.status === "confirmed" ? styleOf(g.context).dot : cn(styleOf(g.context).ring, "ring-2 ring-inset"),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{g.title}</span>
                      <span className="text-muted-foreground block truncate text-[12px]">
                        {[styleOf(g.context).label, g.status === "confirmed" ? null : "w toku", g.startsAt.length > 10 ? g.startsAt.slice(11, 16) : null, g.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                  ))}
                  {/* Drugie granie jednego wieczoru jest OK — można poszukać kolejnego. */}
                  <Link href={`/events?q=${selected.slice(8, 10)}.${selected.slice(5, 7)}`} className="text-primary block px-1 py-1 text-[13px]">
                    Co jeszcze gra tego dnia?
                  </Link>
                </>
              ) : (
                <div className="text-muted-foreground px-1 py-1 text-[13px]">
                  Wolne.{" "}
                  <Link href={`/events?q=${selected.slice(8, 10)}.${selected.slice(5, 7)}`} className="text-primary">
                    Co gra tego dnia?
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => toggle(!open)}
        className={cn(
          "fixed right-3 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
          "bottom-[calc(env(safe-area-inset-bottom)+68px)] md:bottom-5",
          open ? "bg-foreground text-background" : "bg-primary text-primary-foreground",
        )}
        aria-label={open ? "Schowaj kalendarz" : "Pokaż kalendarz"}
        aria-pressed={open}
      >
        <CalendarDays className="size-5" />
      </button>
    </>
  );
}
