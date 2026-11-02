import { BarChart3, Bell, Building2, CalendarDays, MapPin, MessageSquareQuote, Repeat, ShieldCheck, Target, TrainFront, Users } from "lucide-react";
import { PageHeader, Row, Section } from "@/components/ios";
import { ThemeSwitch } from "@/components/theme";
import { getGigTotals } from "@/lib/queries";
import { plural } from "@/lib/text";

function Icon({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`flex size-8 items-center justify-center rounded-lg text-white ${className}`}>{children}</span>;
}

export default async function MorePage() {
  const { total } = await getGigTotals();
  return (
    <>
      <PageHeader title="Więcej" />
      <Section>
        <Row href="/goals" leading={<Icon className="bg-rose-500"><Target className="size-4.5" /></Icon>} title="Cele" />
        <Row href="/stats" leading={<Icon className="bg-emerald-600"><BarChart3 className="size-4.5" /></Icon>} title="Statystyki" detail={plural(total, "występ", "występy", "występów")} />
        <Row href="/trips" leading={<Icon className="bg-indigo-500"><TrainFront className="size-4.5" /></Icon>} title="Podróże" />
        <Row href="/contacts" leading={<Icon className="bg-violet-500"><Users className="size-4.5" /></Icon>} title="Ludzie" />
        <Row href="/thoughts" leading={<Icon className="bg-primary"><MessageSquareQuote className="size-4.5" /></Icon>} title="Myśli po graniach" />
        <Row href="/recurring" leading={<Icon className="bg-teal-600"><Repeat className="size-4.5" /></Icon>} title="Cykliczne open miki" />
        <Row href="/venues" leading={<Icon className="bg-sky-500"><Building2 className="size-4.5" /></Icon>} title="Sceny" />
        <Row href="/settings/security" leading={<Icon className="bg-slate-600"><ShieldCheck className="size-4.5" /></Icon>} title="Bezpieczeństwo i logowanie" />
        <Row href="/settings/notifications" leading={<Icon className="bg-red-500"><Bell className="size-4.5" /></Icon>} title="Powiadomienia" />
        <Row href="/settings/calendar" leading={<Icon className="bg-indigo-500"><CalendarDays className="size-4.5" /></Icon>} title="Kalendarz" />
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
