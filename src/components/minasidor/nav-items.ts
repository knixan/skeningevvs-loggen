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

// Menyns sidor. På dator står alla i sidomenyn. På mobilen står de som
// används ute på jobb i bottenmenyn, och resten som ikoner i toppraden.

export type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  isActive: (p: string) => boolean;
  /**
   * Knapp i bottenmenyn på mobilen. Övriga blir ikoner i toppraden –
   * bottenmenyn har högst fem knappar så att de får plats på 360 px.
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
    iMobilmeny: true,
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

/** Sidorna i bottenmenyn på mobilen. */
export const mobilmenyItems = navItems.filter((i) => i.iMobilmeny);

/** Sidorna som är ikoner i toppraden på mobilen. */
export const toppradItems = navItems.filter((i) => !i.iMobilmeny);

