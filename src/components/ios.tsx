import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Tytuł ekranu: zwarty, ciężki krój; podtytuł (data, status) pod spodem, drobniej. */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 pt-5 md:pt-9">
      {back && (
        <Link
          href={back.href}
          className="text-muted-foreground hover:text-foreground -ml-1 mb-2 inline-flex items-center gap-0.5 text-[14px] font-medium transition-colors"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">{title}</h1>
          {subtitle && <div className="text-muted-foreground mt-1.5 text-[14px]">{subtitle}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/** Grupa: drobna etykieta nad białą kartą z cienką ramką. */
export function Section({
  title,
  footer,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-7", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-muted-foreground text-[12.5px] font-medium">{title}</h2>
          {action}
        </div>
      )}
      <div className="bg-card border-border overflow-hidden rounded-[14px] border">
        {children}
      </div>
      {footer && <p className="text-muted-foreground mt-2 px-1 text-[12.5px] leading-relaxed">{footer}</p>}
    </section>
  );
}

const rowBase =
  "flex min-h-12 items-center gap-3 px-3.5 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border";

/** Wiersz listy. Z `href` staje się linkiem z chevronem. */
export function Row({
  href,
  title,
  subtitle,
  detail,
  leading,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  detail?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        {subtitle && <div className="text-muted-foreground truncate text-[12.5px]">{subtitle}</div>}
      </div>
      {detail && <div className="text-muted-foreground shrink-0 text-[14px]">{detail}</div>}
      {href && <ChevronRight className="text-muted-foreground/40 size-4 shrink-0" />}
    </>
  );
  return href ? (
    <Link href={href} className={cn(rowBase, "active:bg-muted transition-colors hover:bg-muted/50", className)}>
      {content}
    </Link>
  ) : (
    <div className={cn(rowBase, className)}>{content}</div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground px-4 py-6 text-center text-[15px]">{children}</div>;
}

/**
 * Kolory statusów (patrz tokeny --st-* w globals.css): szary = zainteresowany, niebieski = napisałem,
 * ochra = czekam, zieleń = potwierdzone, ceglasty = odrzucone, jasny szary = odwołane.
 */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-st-int",
  info: "text-st-con",
  warning: "text-st-wai",
  success: "text-st-ok",
  danger: "text-st-rej",
  muted: "text-st-can",
};

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-st-int/12",
  info: "bg-st-con/12",
  warning: "bg-st-wai/14",
  success: "bg-st-ok/12",
  danger: "bg-st-rej/12",
  muted: "bg-st-can/16",
};

/** Plakietka statusu: kropka + etykieta na lekko zabarwionym tle. */
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[11.5px] font-semibold whitespace-nowrap",
        TONE_TEXT[tone],
        TONE_BG[tone],
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Rating({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <span className="text-foreground font-semibold tabular-nums">
      ★ {Number.isInteger(value) ? value : value.toFixed(1)}
    </span>
  );
}

/** Kafelek ze statystyką. */
export function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-3.5">
      <div className="text-muted-foreground text-[12px]">{label}</div>
      <div className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em]">{value}</div>
    </div>
  );
}
