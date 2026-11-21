import {
  LayoutDashboard,
  Plus,
  FilePenLine,
  Users,
  Building2,
  Settings,
  ChartColumn,
  Receipt,
  type LucideIcon,
} from "lucide-react";

// Menyns sidor. En vanlig modul (inte "use client"), så att både menyn och
// serversidan "Mer" kan läsa listan.

export type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  isActive: (p: string) => boolean;
  /**
   * Egen knapp i bottenmenyn på mobilen. Övriga nås via "Mer" – bottenmenyn
   * har högst fem knappar så att de får plats med tummen på 360 px.
   */
  iMobilmeny: boolean;
};

export const navItems: NavItem[] = [
  {
    href: "/mina-sidor",
    label: "Mina jobb",
    mobileLabel: "Jobb",
    icon: LayoutDashboard,
    isActive: (p) => p === "/mina-sidor" || p.startsWith("/mina-sidor/jobb"),
    iMobilmeny: true,
  },
  {
    href: "/mina-sidor/nytt-jobb",
    label: "Nytt jobb",
    mobileLabel: "Nytt jobb",
    icon: Plus,
    isActive: (p) => p.startsWith("/mina-sidor/nytt-jobb"),
    iMobilmeny: true,
  },
  {
    href: "/mina-sidor/kunder",
    label: "Kundregister",
    mobileLabel: "Kunder",
    icon: Users,
    isActive: (p) => p.startsWith("/mina-sidor/kunder"),
    iMobilmeny: true,
  },
  {
    href: "/mina-sidor/offerter",
    label: "Offerter",
    mobileLabel: "Offerter",
    icon: FilePenLine,
    isActive: (p) => p.startsWith("/mina-sidor/offerter"),
    iMobilmeny: true,
  },
  {
    href: "/mina-sidor/fakturor",
    label: "Fakturor",
    mobileLabel: "Fakturor",
    icon: Receipt,
    isActive: (p) => p.startsWith("/mina-sidor/fakturor"),
    iMobilmeny: false,
  },
  {
    href: "/mina-sidor/statistik",
    label: "Statistik",
    mobileLabel: "Statistik",
    icon: ChartColumn,
    isActive: (p) => p.startsWith("/mina-sidor/statistik"),
    iMobilmeny: false,
  },
  {
    href: "/mina-sidor/foretag",
    label: "Företagsuppgifter",
    mobileLabel: "Företag",
    icon: Building2,
    isActive: (p) => p.startsWith("/mina-sidor/foretag"),
    iMobilmeny: false,
  },
  {
    href: "/mina-sidor/installningar",
    label: "Inställningar",
    mobileLabel: "Inställningar",
    icon: Settings,
    isActive: (p) => p.startsWith("/mina-sidor/installningar"),
    iMobilmeny: false,
  },
];

/** Sidorna som nås via "Mer" på mobilen. */
export const merItems = navItems.filter((i) => !i.iMobilmeny);

