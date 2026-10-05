"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pola formularzy w stylu iOS: etykieta po lewej, kontrolka po prawej,
 * w kartach. Natywne selecty i pickery dat — na iPhonie dają systemowe kółka.
 */
const control =
  "w-full bg-transparent text-right text-[16px] outline-none placeholder:text-muted-foreground/60";

export function FieldRow({ label, children, stacked }: { label: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <label
      className={cn(
        "flex min-h-12 gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/70",
        stacked ? "flex-col" : "items-center",
      )}
    >
      <span className={cn("shrink-0 text-[16px]", stacked && "text-muted-foreground text-[13px]")}>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function NumberInput(props: React.ComponentProps<"input">) {
  return <TextInput type="number" inputMode="numeric" min={0} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  options,
  placeholder = "—",
  className,
  ...props
}: React.ComponentProps<"select"> & { options: { value: string | number; label: string }[]; placeholder?: string }) {
  return (
    <select className={cn(control, "text-muted-foreground [&:has(option:checked:not([value='']))]:text-foreground appearance-none", className)} {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Przełącznik iOS oparty o natywny checkbox (działa w FormData bez JS). */
export function Toggle({ name, defaultChecked }: { name: string; defaultChecked?: boolean }) {
  return (
    <span className="relative ml-auto inline-flex shrink-0">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="bg-input peer-checked:bg-primary h-[31px] w-[51px] rounded-full transition-colors" />
      <span className="absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-5" />
    </span>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={cn("h-12 w-full rounded-xl text-[17px] font-semibold", className)}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Przycisk akcji serwerowej z potwierdzeniem (np. usuwanie). */
export function ConfirmButton({
  action,
  children,
  confirm = "Na pewno?",
  className,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={cn("text-destructive h-12 w-full text-[17px]", className)}>
        {children}
      </button>
    </form>
  );
}
