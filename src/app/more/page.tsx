import { BookOpen, Building2, MapPin, MessageSquareQuote, Target } from "lucide-react";
import { PageHeader, Row, Section } from "@/components/ios";
import { ThemeSwitch } from "@/components/theme";

function Icon({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`flex size-8 items-center justify-center rounded-lg text-white ${className}`}>{children}</span>;
}

export default function MorePage() {
  return (
    <>
      <PageHeader title="Więcej" />
      <Section>
        <Row href="/goals" leading={<Icon className="bg-rose-500"><Target className="size-4.5" /></Icon>} title="Cele" />
        <Row href="/bits" leading={<Icon className="bg-violet-500"><BookOpen className="size-4.5" /></Icon>} title="Materiał" />
        <Row href="/thoughts" leading={<Icon className="bg-primary"><MessageSquareQuote className="size-4.5" /></Icon>} title="Myśli po graniach" />
        <Row href="/venues" leading={<Icon className="bg-sky-500"><Building2 className="size-4.5" /></Icon>} title="Sceny" />
        <Row href="/cities" leading={<Icon className="bg-amber-500"><MapPin className="size-4.5" /></Icon>} title="Miasta i dojazd" />
      </Section>
      <Section title="Wygląd">
        <div className="p-2">
          <ThemeSwitch />
        </div>
      </Section>
    </>
  );
}
