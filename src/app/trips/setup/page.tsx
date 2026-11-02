import { headers } from "next/headers";
import { PageHeader, Section } from "@/components/ios";
import { CopyBox } from "./copy-box";

/** Skrypt czytający stronę biletu — ten sam w skrócie iOS i w bookmarklecie. */
const READ_PAGE = "JSON.stringify({u:location.href,t:(document.querySelector('main')||document.body).innerText.slice(0,8000)})";

/** Skrypt Google Apps Script: maile od KOLEO z Gmaila → /api/ingest/ticket (co 10 min, raz na mail). */
function gmailScript(app: string) {
  return `// SU Manager — bilety KOLEO z Gmaila. Wklej na script.google.com, uzupełnij TOKEN, uruchom „setup”.
const APP = '${app}';
const TOKEN = 'WKLEJ_TU_CRON_SECRET';
const QUERY = 'from:kasa.biletowa@koleo.pl -label:su-manager newer_than:14d';

function checkTickets() {
  const label = GmailApp.getUserLabelByName('su-manager') || GmailApp.createLabel('su-manager');
  for (const thread of GmailApp.search(QUERY)) {
    let ok = true;
    for (const msg of thread.getMessages()) {
      const pdfs = msg.getAttachments().filter((a) => a.getContentType() === 'application/pdf' || /\\.pdf$/i.test(a.getName()));
      const bodies = pdfs.length
        ? pdfs.map((a) => ({ pdf: Utilities.base64Encode(a.getBytes()) }))
        : [{ text: msg.getPlainBody() }];
      for (const body of bodies) {
        const res = UrlFetchApp.fetch(APP + '/api/ingest/ticket', {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + TOKEN },
          payload: JSON.stringify(body),
          muteHttpExceptions: true,
        });
        console.log(res.getResponseCode(), res.getContentText());
        if (res.getResponseCode() === 401 || res.getResponseCode() >= 500) ok = false;
      }
    }
    if (ok) thread.addLabel(label); // oznaczony = przetworzony, drugi raz go nie weźmie
  }
}

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkTickets').timeBased().everyMinutes(10).create();
  checkTickets();
}`;
}

/** Jak dodawać bilety: automat z Gmaila, wgranie PDF-a, skróty „Udostępnij” (iPhone) i bookmarklet (komputer). */
export default async function TripSetupPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const importUrl = `${origin}/trips/import#`;
  const bookmarklet = `javascript:(()=>{window.open('${importUrl}'+encodeURIComponent(${READ_PAGE}),'_blank')})()`;
  const step = "flex gap-3 px-4 py-2.5 text-[15px] leading-snug [&:not(:last-child)]:border-b border-border/70";

  return (
    <>
      <PageHeader title="Jak dodawać bilety" back={{ href: "/trips", label: "Podróże" }} />

      <Section
        title="Automatycznie z Gmaila (polecane)"
        footer="Ustawiasz raz. Potem każdy bilet od kasa.biletowa@koleo.pl sam trafia do Podróży (podpięty do grania albo jako prywatna podróż) i dostajesz powiadomienie. Skrypt działa na Twoim koncie Google — nikt poza Tobą go nie widzi."
      >
        <div className={step}>
          <b>1.</b>
          <span>
            Na komputerze wejdź na <b>script.google.com</b> → <b>Nowy projekt</b>, nazwij „SU Manager — bilety”.
          </span>
        </div>
        <div className={`${step} flex-col`}>
          <span>
            <b>2.</b> Usuń przykładowy kod i wklej ten. W linii <b>TOKEN</b> wpisz swój <b>CRON_SECRET</b> (ten sam co w cron-job.org):
          </span>
          <CopyBox text={gmailScript(origin)} label="Kopiuj skrypt" />
        </div>
        <div className={step}>
          <b>3.</b>
          <span>
            Zapisz, z listy funkcji wybierz <b>setup</b> → <b>Uruchom</b> i zgódź się na dostęp do Gmaila („Zaawansowane → Przejdź do projektu”, bo to Twój własny skrypt). Gotowe — sprawdza co 10 minut.
          </span>
        </div>
      </Section>

      <Section title="Wgraj PDF biletu" footer="Bez ustawiania czegokolwiek: Podróże → Dodaj → „Wgraj PDF biletu” (PDF z maila zapisz najpierw w Plikach).">
        <div className="text-muted-foreground px-4 py-2.5 text-[14px]">Działa też dla biletów spoza Gmaila.</div>
      </Section>

      <Section
        title="Dodatkowo: iPhone — „Udostępnij → Dodaj do SU Manager”"
        footer="Działa na stronie biletu w Safari (koleo.pl/ticket/…), nie w aplikacji KOLEO. Skrót niczego nie wysyła do KOLEO — czyta tylko otwartą stronę i otwiera SU Managera z gotowymi danymi do sprawdzenia."
      >
        <div className={step}>
          <b>1.</b>
          <span>
            Ustawienia → Aplikacje → Skróty → Zaawansowane → włącz <b>Zezwalaj na uruchamianie skryptów</b>.
          </span>
        </div>
        <div className={step}>
          <b>2.</b>
          <span>
            Skróty → <b>+</b> → nazwij „Dodaj do SU Manager”. W ⓘ włącz <b>Pokaż w arkuszu udostępniania</b> i zostaw tylko typ <b>Strony Safari</b>.
          </span>
        </div>
        <div className={`${step} flex-col`}>
          <span>
            <b>3.</b> Dodaj akcję <b>Uruchom JavaScript na stronie</b> i wklej:
          </span>
          <CopyBox text={`completion(${READ_PAGE});`} label="Kopiuj skrypt" />
        </div>
        <div className={step}>
          <b>4.</b>
          <span>
            Dodaj akcję <b>Koduj URL</b> (na wyniku JavaScriptu).
          </span>
        </div>
        <div className={`${step} flex-col`}>
          <span>
            <b>5.</b> Dodaj akcję <b>Tekst</b>: wklej poniższy adres i zaraz za nim wstaw zmienną <b>Zakodowany URL</b>:
          </span>
          <CopyBox text={importUrl} label="Kopiuj adres" />
        </div>
        <div className={step}>
          <b>6.</b>
          <span>
            Dodaj akcję <b>Otwórz adresy URL</b>. Gotowe — na stronie biletu: Udostępnij → <b>Dodaj do SU Manager</b>.
          </span>
        </div>
      </Section>

      <Section
        title="Dodatkowo: iPhone — „Udostępnij” na PDF-ie biletu"
        footer="Osobny skrót dla PDF-ów: w mailu albo w Plikach otwórz PDF biletu → Udostępnij → „Dodaj bilet PDF do SU Manager”. Odczyt jest ten sam co ze strony."
      >
        <div className={step}>
          <b>1.</b>
          <span>
            Skróty → <b>+</b> → nazwij „Dodaj bilet PDF do SU Manager”. W ⓘ włącz <b>Pokaż w arkuszu udostępniania</b> i zostaw tylko typ <b>PDF</b>.
          </span>
        </div>
        <div className={step}>
          <b>2.</b>
          <span>
            Dodaj akcję <b>Pobierz tekst z PDF</b> (z danych wejściowych skrótu), potem <b>Koduj URL</b>.
          </span>
        </div>
        <div className={`${step} flex-col`}>
          <span>
            <b>3.</b> Dodaj akcję <b>Tekst</b> z tym adresem i zaraz za nim zmienną <b>Zakodowany URL</b>, a na końcu <b>Otwórz adresy URL</b>:
          </span>
          <CopyBox text={importUrl} label="Kopiuj adres" />
        </div>
      </Section>

      <Section
        title="Komputer — przycisk na pasku zakładek"
        footer="Dodaj nową zakładkę (np. „+ SU Manager”) i jako adres wklej poniższy kod. Na stronie biletu kliknij zakładkę — otworzy się nowa karta z podróżą do zapisania."
      >
        <div className="p-2">
          <CopyBox text={bookmarklet} label="Kopiuj bookmarklet" />
        </div>
      </Section>

      <Section title="Bez skrótu" footer="Na stronie biletu albo w PDF-ie zaznacz wszystko, skopiuj i wklej w Podróże → Dodaj.">
        <div className="text-muted-foreground px-4 py-2.5 text-[14px]">Zawsze działa, też dla innych przewoźników — czego parser nie rozpozna, uzupełnisz ręcznie.</div>
      </Section>
    </>
  );
}
