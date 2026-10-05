"use client";

import { CalendarDays, Ellipsis, House, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Dziś", icon: House, match: (p: string) => p === "/" },
  { href: "/gigs", label: "Grania", icon: CalendarDays, match: (p: string) => p.startsWith("/gigs") },
  { href: "/contacts", label: "Ludzie", icon: Users, match: (p: string) => p.startsWith("/contacts") },
  { href: "/events", label: "Okazje", icon: Sparkles, match: (p: string) => p.startsWith("/events") },
  {
    href: "/more",
    label: "Więcej",
    icon: Ellipsis,
    match: (p: string) => ["/more", "/bits", "/venues", "/cities", "/thoughts"].some((x) => p.startsWith(x)),
  },
];

/**
 * Na telefonie: dolny tab bar z rozmyciem (jak w iOS).
 * Na desktopie: ten sam zestaw jako pływający pasek u góry.
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl backdrop-saturate-150",
        "pb-[env(safe-area-inset-bottom)]",
        "md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0",
      )}
    >
      <div className="mx-auto flex max-w-2xl md:h-14 md:items-center md:gap-1 md:px-4">
        <span className="hidden pr-4 text-[15px] font-semibold tracking-tight md:block">
          <span className="text-primary">●</span> SU Manager
        </span>
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium transition-colors",
                "md:flex-none md:flex-row md:gap-2 md:rounded-full md:px-3 md:py-1.5 md:text-sm",
                active ? "text-primary md:bg-accent md:text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-6 md:size-4" strokeWidth={active ? 2.3 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
