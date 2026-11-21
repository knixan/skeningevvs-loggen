"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function TopBar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await signOut();
    router.push("/logga-in");
    router.refresh();
  }

  return (
    // print:hidden – syns inte på utskrivna fakturor och offerter
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 print:hidden">
      <Image
        src="/skeningevvs-faktura-logga.png"
        alt="Skeninge VVS logotyp"
        width={300}
        height={300}
        className="h-18 w-18 object-contain"
        priority
      />
      <Link href="/mina-sidor" className="font-semibold">
        Skeninge VVS - Loggen
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? "Loggar ut…" : "Logga ut"}
      </Button>
    </header>
  );
}
