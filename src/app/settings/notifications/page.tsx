import { PageHeader, Section } from "@/components/ios";
import { PushSettings } from "@/components/push-settings";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Powiadomienia" back={{ href: "/more", label: "Więcej" }} />
      <Section>
        <PushSettings />
      </Section>
      <Section title="Kiedy przychodzą">
        <ul className="list-disc space-y-1.5 py-3 pr-4 pl-9 text-[15px] leading-relaxed">
          <li>
            <b>Rano (~10:30):</b> grania do ponowienia dziś, z podpowiedzią kanału, i „napisz” do grań oznaczonych jako zainteresowany — 2 tygodnie i tydzień przed.
          </li>
          <li>
            <b>Wieczorem (~21:00):</b> trening puent, jeśli dziś go nie było (z serią dni), i „jak poszło?” po graniu bez oceny.
          </li>
        </ul>
        <p className="text-muted-foreground px-4 pb-3 text-[13px]">Każde przypomnienie przychodzi najwyżej raz dziennie.</p>
      </Section>
    </>
  );
}
