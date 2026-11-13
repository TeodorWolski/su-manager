"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { identify } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function ThemeProvider({ children, posthogDistinctId }: { children: React.ReactNode; posthogDistinctId?: string }) {
  const identified = useRef(false);

  useEffect(() => {
    if (posthogDistinctId) {
      identify(posthogDistinctId);
      identified.current = true;
    } else if (identified.current) {
      identify(null);
      identified.current = false;
    }
  }, [posthogDistinctId]);

  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const OPTIONS = [
  { value: "light", label: "Jasny", icon: Sun },
  { value: "dark", label: "Ciemny", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Segmented control jak w ustawieniach iOS. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <div className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all",
            mounted && theme === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
