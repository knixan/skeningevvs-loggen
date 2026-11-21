"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { merItems, navItems } from "./nav-items";

/** Utskrifter (faktura, offert) visas utan meny. */
function arUtskrift(pathname: string) {
  return pathname.endsWith("/skriv-ut");
}

export function MinaSidorSidebar() {
  const pathname = usePathname();
  if (arUtskrift(pathname)) return null;

  return (
    <aside className="hidden md:flex w-52 shrink-0 flex-col border-r print:hidden">
      <nav
        aria-label="Huvudmeny"
        className="sticky top-4 flex flex-col gap-0.5 p-2 pt-4"
      >
        {navItems.map(({ href, label, icon: Icon, isActive }) => {
          const aktiv = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={aktiv ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                aktiv
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MinaSidorMobileNav() {
  const pathname = usePathname();
  if (arUtskrift(pathname)) return null;

  const knappar = [
    ...navItems.filter((i) => i.iMobilmeny),
    {
      href: "/mina-sidor/mer",
      mobileLabel: "Mer",
      icon: Menu,
      // Mer är aktiv på sin egen sida och på alla sidor under den
      isActive: (p: string) =>
        p.startsWith("/mina-sidor/mer") || merItems.some((i) => i.isActive(p)),
    },
  ];

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background md:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {knappar.map(({ href, mobileLabel, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span className="max-w-full truncate">{mobileLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
