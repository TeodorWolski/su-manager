import { cn } from "@/lib/utils";

/** Multi-select jako „pigułki” — natywne checkboxy, więc działa w FormData bez stanu. */
export function Chips({
  name,
  options,
  selected = [],
  empty,
}: {
  name: string;
  options: { value: number; label: string }[];
  selected?: number[];
  empty?: React.ReactNode;
}) {
  if (!options.length) return <p className="text-muted-foreground px-4 text-[15px]">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "bg-card cursor-pointer rounded-full px-3.5 py-2 text-[15px] transition-all select-none active:scale-95",
            "has-checked:bg-primary has-checked:text-primary-foreground",
          )}
        >
          <input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}
