"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  FilePenLine,
  Users,
  Building2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/mina-sidor",
    label: "Mina jobb",
    mobileLabel: "Jobb",
    icon: LayoutDashboard,
    isActive: (p: string) =>
      p === "/mina-sidor" || p.startsWith("/mina-sidor/jobb"),
  },
  {
    href: "/mina-sidor/nytt-jobb",
    label: "Nytt jobb",
    mobileLabel: "Nytt",
    icon: Plus,
    isActive: (p: string) => p.startsWith("/mina-sidor/nytt-jobb"),
  },
  {
    href: "/mina-sidor/offerter",
    label: "Offerter",
    mobileLabel: "Offerter",
    icon: FilePenLine,
    isActive: (p: string) => p.startsWith("/mina-sidor/offerter"),
  },
  {
    href: "/mina-sidor/kunder",
    label: "Kundregister",
    mobileLabel: "Kunder",
    icon: Users,
    isActive: (p: string) => p.startsWith("/mina-sidor/kunder"),
  },
  {
    href: "/mina-sidor/foretag",
    label: "Företagsuppgifter",
    mobileLabel: "Företag",
    icon: Building2,
    isActive: (p: string) => p.startsWith("/mina-sidor/foretag"),
  },
  {
    href: "/mina-sidor/installningar",
    label: "Inställningar",
    mobileLabel: "Mer",
    icon: Settings,
    isActive: (p: string) => p.startsWith("/mina-sidor/installningar"),
  },
];

export function MinaSidorSidebar() {
  const pathname = usePathname();
  if (pathname.endsWith("/skriv-ut")) return null;

  return (
    <aside className="hidden md:flex w-52 shrink-0 flex-col border-r">
      <nav className="sticky top-4 flex flex-col gap-0.5 p-2 pt-4">
        {navItems.map(({ href, label, icon: Icon, isActive }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(pathname)
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function MinaSidorMobileNav() {
  const pathname = usePathname();
  if (pathname.endsWith("/skriv-ut")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navItems.map(({ href, mobileLabel, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            {mobileLabel}
          </Link>
        );
      })}
    </nav>
  );
}
