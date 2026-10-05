import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Duży tytuł ekranu (Large Title z HIG) + opcjonalna akcja po prawej. */
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
    <header className="mb-6 pt-4 md:pt-8">
      {back && (
        <Link
          href={back.href}
          className="text-primary -ml-1.5 mb-1 inline-flex items-center text-[17px]"
        >
          <ChevronLeft className="size-6" />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight text-balance">{title}</h1>
          {subtitle && <div className="text-muted-foreground mt-1 text-[15px]">{subtitle}</div>}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
    </header>
  );
}

/** Grupa w stylu „inset grouped list”. */
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
        <div className="mb-1.5 flex items-baseline justify-between px-4">
          <h2 className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">{title}</h2>
          {action}
        </div>
      )}
      <div className="bg-card overflow-hidden rounded-2xl shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-none">
        {children}
      </div>
      {footer && <p className="text-muted-foreground mt-1.5 px-4 text-[13px]">{footer}</p>}
    </section>
  );
}

const rowBase =
  "flex min-h-12 items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/70";

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
        <div className="truncate text-[16px]">{title}</div>
        {subtitle && <div className="text-muted-foreground truncate text-[13px]">{subtitle}</div>}
      </div>
      {detail && <div className="text-muted-foreground shrink-0 text-[15px]">{detail}</div>}
      {href && <ChevronRight className="text-muted-foreground/50 size-4 shrink-0" />}
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

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  warning: "bg-warning/15 text-amber-700 dark:text-warning",
  success: "bg-primary/14 text-primary",
  danger: "bg-destructive/12 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", TONES[tone])}>
      {children}
    </span>
  );
}

export function Rating({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <span className="text-primary font-semibold tabular-nums">
      ★ {Number.isInteger(value) ? value : value.toFixed(1)}
    </span>
  );
}

/** Kafelek ze statystyką. */
export function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-none">
      <div className="text-muted-foreground text-[13px]">{label}</div>
      <div className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
