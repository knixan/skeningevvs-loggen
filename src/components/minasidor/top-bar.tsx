"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <Link href="/mina-sidor" className="font-semibold">
        Skeningevvs-loggen
      </Link>
      <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading}>
        {loading ? "Loggar ut…" : "Logga ut"}
      </Button>
    </header>
  );
}
