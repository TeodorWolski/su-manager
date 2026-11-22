import { CopyBox } from "@/app/trips/setup/copy-box";
import { CopyField } from "@/components/copy-field";
import { PageHeader, Section } from "@/components/ios";
import { EVENING_FROM, EVENING_TO } from "@/lib/calendar-sync";
import { googleScript, PENDING_CALENDAR_NAME } from "@/lib/google-script";
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

      <Section
        title="Prośby w toku i zajęte wieczory"
        footer={`Co 10 minut, przez skrypt na Twoim koncie Google. Wieczór = ${EVENING_FROM}–${EVENING_TO}; całodniowe wydarzenia i odrzucone zaproszenia go nie zajmują. Z Twojego kalendarza apka dostaje godziny i tytuły — bez opisów, miejsc i uczestników; trzyma je tylko w swojej bazie.`}
      >
        <ul className="text-muted-foreground list-disc space-y-1.5 py-3 pr-4 pl-9 text-[15px] leading-relaxed">
          <li>
            Grania „napisałem” i „czekam” lądują w osobnym, szarym kalendarzu <b className="text-foreground">{PENDING_CALENDAR_NAME}</b> jako „❓ czekam · …”
            — widać je przy umawianiu się, a zwykły kalendarz grań dalej ma tylko zaklepane. Po zgodzie wpis przechodzi do grań, po odmowie znika.
          </li>
          <li>
            W drugą stronę: mini kalendarz pokazuje 📅 przy dniach z czymś w Twoim kalendarzu (po kliknięciu — co i o której), a zajęte wieczory apka
            pomija w okazjach i ostrzega przy prośbie o granie na taki wieczór.
          </li>
        </ul>
      </Section>
      <Section title="Jak włączyć" footer="Masz już skrypt od biletów? Podmień w nim cały kod na ten i uruchom setup jeszcze raz. W Dzienniku wykonywania po każdej synchronizacji jest linijka „kalendarz: … wydarzeń”.">
        <ol className="list-decimal space-y-1.5 py-3 pr-4 pl-9 text-[15px] leading-relaxed">
          <li>
            Na komputerze: <b>script.google.com</b> → Twój projekt „SU Manager — bilety” (albo <b>Nowy projekt</b>).
          </li>
          <li>
            Wklej cały kod poniżej. W linii <b>TOKEN</b> wpisz swój <b>CRON_SECRET</b>.
          </li>
          <li>
            Zapisz, wybierz funkcję <b>setup</b> → <b>Uruchom</b> i zgódź się na dostęp do Gmaila i Kalendarza.
          </li>
        </ol>
        <div className="px-2 pb-2">
          <CopyBox text={googleScript(base)} label="Kopiuj skrypt" />
        </div>
      </Section>
    </>
  );
}
