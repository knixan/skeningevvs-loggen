"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { toppradItems } from "./nav-items";

// Logotypen till vänster. Till höger: på mobilen ikoner för sidorna som inte
// får plats i bottenmenyn (statistik, företag, inställningar), och alltid
// Logga ut. Ikonerna har aria-label och title, eftersom de saknar text.

const IKONKNAPP =
  "inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 [&_svg]:size-5";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await signOut();
    router.push("/logga-in");
    router.refresh();
  }

  return (
    // print:hidden – syns inte på utskrivna fakturor och offerter
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 print:hidden">
      <Link href="/mina-sidor" aria-label="Till jobben" className="shrink-0">
        <Image
          src="/skeningevvs-faktura-logga.png"
          alt="Skeninge VVS"
          width={800}
          height={271}
          className="h-10 w-auto"
          priority
        />
      </Link>

      <nav aria-label="Fler sidor" className="flex items-center gap-1">
        {toppradItems.map(({ href, mobileLabel, icon: Icon, isActive }) => {
          const aktiv = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={mobileLabel}
              title={mobileLabel}
              aria-current={aktiv ? "page" : undefined}
              className={cn(
                IKONKNAPP,
                "md:hidden",
                aktiv && "bg-muted text-foreground",
              )}
            >
              <Icon aria-hidden />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          aria-label={loading ? "Loggar ut" : "Logga ut"}
          title="Logga ut"
          className={IKONKNAPP}
        >
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
        </button>
      </nav>
    </header>
  );
}
