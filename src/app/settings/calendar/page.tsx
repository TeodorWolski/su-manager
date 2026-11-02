import { CopyField } from "@/components/copy-field";
import { PageHeader, Section } from "@/components/ios";
import { ARRIVE_BEFORE_MIN } from "@/lib/ics";
import { TRAIN_CALENDAR_LEAD_MIN } from "@/lib/trips";

export default function CalendarSettingsPage() {
  const token = process.env.CALENDAR_TOKEN;
  const base = process.env.APP_URL ?? "https://su-manager.vercel.app";
  const url = token ? `${base}/calendar/${token}.ics` : null;

  return (
    <>
      <PageHeader title="Kalendarz" back={{ href: "/more", label: "Więcej" }} />
      {url ? (
        <>
          <Section
            title="Link do subskrypcji"
            footer="Link jest tajny — każdy, kto go zna, zobaczy Twoje grania i podróże. Nie wklejaj go publicznie."
          >
            <CopyField value={url} />
          </Section>
          <Section title="Jak dodać do Google Calendar">
            <ol className="list-decimal space-y-1.5 py-3 pr-4 pl-9 text-[15px] leading-relaxed">
              <li>Skopiuj link powyżej.</li>
              <li>
                Na komputerze otwórz calendar.google.com → obok „Inne kalendarze” kliknij <b>+</b> →{" "}
                <b>Z adresu URL</b>.
              </li>
              <li>Wklej link i kliknij „Dodaj kalendarz”. Pojawi się kalendarz „Grania (SU Manager)”.</li>
              <li>Na telefonie włącz go w aplikacji Google Calendar → Ustawienia → widoczne kalendarze.</li>
            </ol>
          </Section>
          <Section title="Co trafia do kalendarza">
            <ul className="text-muted-foreground list-disc space-y-1.5 py-3 pr-4 pl-9 text-[15px] leading-relaxed">
              <li>Potwierdzone grania i podróże (pociągi z Podróży).</li>
              <li>
                Wpis zaczyna się <b className="text-foreground">{ARRIVE_BEFORE_MIN} min przed startem sceny</b> — scena o 19:00 to w
                kalendarzu 18:00. W opisie: godzina sceny, przed kim, link do biletów.
              </li>
              <li>Granie bez godziny — wydarzenie całodniowe z dopiskiem „godzina nieznana”.</li>
              <li>
                Pociąg zaczyna się <b className="text-foreground">{TRAIN_CALENDAR_LEAD_MIN} min przed odjazdem</b> (odjazd 17:10 → w kalendarzu
                17:00) i kończy przy przyjeździe; w opisie godzina odjazdu, pociąg, miejsce i granie.
              </li>
              <li>Google odświeża subskrybowane kalendarze co kilka–kilkanaście godzin, więc zmiany nie są natychmiastowe.</li>
            </ul>
          </Section>
        </>
      ) : (
        <Section>
          <p className="px-4 py-3 text-[15px]">Brak zmiennej CALENDAR_TOKEN — kalendarz jest wyłączony.</p>
        </Section>
      )}
    </>
  );
}
