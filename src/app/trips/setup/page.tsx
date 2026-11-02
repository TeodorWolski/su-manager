import { headers } from "next/headers";
import { PageHeader, Section } from "@/components/ios";
import { CopyBox } from "./copy-box";

/** Skrypt czytający stronę biletu — ten sam w skrócie iOS i w bookmarklecie. */
const READ_PAGE = "JSON.stringify({u:location.href,t:(document.querySelector('main')||document.body).innerText.slice(0,8000)})";

/** Jak dodawać bilety jednym tapem: skrót w „Udostępnij” (iPhone) i bookmarklet (komputer). */
export default async function TripSetupPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const importUrl = `${origin}/trips/import#`;
  const bookmarklet = `javascript:(()=>{window.open('${importUrl}'+encodeURIComponent(${READ_PAGE}),'_blank')})()`;
  const step = "flex gap-3 px-4 py-2.5 text-[15px] leading-snug [&:not(:last-child)]:border-b border-border/70";

  return (
    <>
      <PageHeader title="Bilety jednym tapem" back={{ href: "/trips", label: "Podróże" }} />

      <Section
        title="iPhone — „Udostępnij → Dodaj do SU Manager”"
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
        title="Komputer — przycisk na pasku zakładek"
        footer="Dodaj nową zakładkę (np. „+ SU Manager”) i jako adres wklej poniższy kod. Na stronie biletu kliknij zakładkę — otworzy się nowa karta z podróżą do zapisania."
      >
        <div className="p-2">
          <CopyBox text={bookmarklet} label="Kopiuj bookmarklet" />
        </div>
      </Section>

      <Section title="Bez skrótu" footer="Na stronie biletu zaznacz wszystko, skopiuj i wklej w Podróże → Dodaj.">
        <div className="text-muted-foreground px-4 py-2.5 text-[14px]">Zawsze działa, też dla innych przewoźników — czego parser nie rozpozna, uzupełnisz ręcznie.</div>
      </Section>
    </>
  );
}
