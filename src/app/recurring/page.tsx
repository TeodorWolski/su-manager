import { setSeriesMode } from "@/app/actions";
import { PendingButton } from "@/components/form";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { describe } from "@/lib/recurring";
import { loadSeries } from "@/lib/recurring-sync";
import { fmtDate } from "@/lib/time";

/** Cykliczne serie: wykryte i oznaczone przeze mnie, z najbliższymi terminami; wyłączone na dole. */
export default async function RecurringPage() {
  const { series, decisions } = await loadSeries();
  const off = decisions.filter((d) => d.mode === "off");
  return (
    <>
      <PageHeader title="Cykliczne" back={{ href: "/more", label: "Więcej" }} />
      <Section
        footer="Wykrywam serie z co najmniej 3 terminów w tym samym dniu tygodnia i stałym odstępie. Rytm ustawisz albo wyłączysz w Okazjach („Cykliczne?” przy wydarzeniu). Przewidywane terminy — na 8 tygodni naprzód; prawdziwy termin z bileterii zawsze wygrywa."
      >
        {series.length ? (
          series.map((s) => {
            const next = [...s.realUpcoming.map((d) => ({ d, real: true })), ...s.predicted.map((d) => ({ d: d.slice(0, 10), real: false }))]
              .sort((a, b) => a.d.localeCompare(b.d))
              .slice(0, 4);
            return (
              <div key={s.key} className="border-border/70 px-4 py-3 [&:not(:last-child)]:border-b">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15.5px] leading-snug font-medium">{s.title}</div>
                    <div className="text-muted-foreground text-[13px]">
                      {[s.venueName, s.cityName].filter(Boolean).join(", ")} · {describe(s.interval, s.anchor)}
                    </div>
                  </div>
                  <Pill tone={s.how === "manual" ? "info" : "neutral"}>{s.how === "manual" ? "ręcznie" : "wykryte"}</Pill>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[12.5px]">
                  {next.map((n) => (
                    <span key={n.d} className={n.real ? "text-foreground" : "text-muted-foreground"}>
                      {fmtDate(n.d)}
                      {!n.real && " (?)"}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <form action={setSeriesMode.bind(null, s.key, "off", s.title)}>
                    <PendingButton className="bg-secondary text-secondary-foreground h-8 rounded-lg px-3 text-[13px]">
                      To nie jest cykliczne
                    </PendingButton>
                  </form>
                  {s.how === "manual" && (
                    <form action={setSeriesMode.bind(null, s.key, "auto", s.title)}>
                      <PendingButton className="text-primary h-8 px-1 text-[13px]">Wykrywaj sam</PendingButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <Empty>Jeszcze żadnej serii — oznacz open mic jako cykliczny w Okazjach.</Empty>
        )}
      </Section>

      {off.length > 0 && (
        <Section title={`Wyłączone · ${off.length}`}>
          {off.map((d) => (
            <div key={d.key} className="border-border/70 flex items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b">
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {d.title}
                {d.cityName && <span className="text-muted-foreground"> · {d.cityName}</span>}
              </span>
              <form action={setSeriesMode.bind(null, d.key, "auto", d.title)}>
                <PendingButton className="text-primary h-8 text-[14px]">Przywróć</PendingButton>
              </form>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
