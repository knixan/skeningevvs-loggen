"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;

    setLoading(true);
    const result = await signIn.email({ email, password });
    setLoading(false);

    if (result.error) {
      // Visa "fel lösenord" bara när det verkligen är det – andra fel (t.ex.
      // fel adress/origin eller för många försök) ska inte se likadana ut.
      if (result.error.code === "INVALID_EMAIL_OR_PASSWORD") {
        setError("Fel e-post eller lösenord.");
      } else if (result.error.code === "INVALID_ORIGIN") {
        setError(
          `Inloggning är inte tillåten från ${window.location.origin}. Öppna appen via adressen i BETTER_AUTH_URL.`,
        );
      } else if (result.error.status === 429) {
        setError("För många försök. Vänta en stund och försök igen.");
      } else {
        setError(
          `Inloggningen misslyckades (${result.error.status}): ${result.error.message ?? "okänt fel"}`,
        );
      }
      return;
    }

    router.push("/mina-sidor");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md rounded-2xl shadow-xs">
          <Image
                src="/skeningevvs-faktura-logga.png"
                alt="Skeninge VVS logotyp"
                width={300}
                height={300}
                className="h-48 w-48 object-contain"
                priority
              />
      <CardHeader>
        <CardTitle className="text-2xl">Logga in</CardTitle>
      </CardHeader>
       
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="din@epost.se"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loggar in…" : "Logga in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Inget konto?{" "}
          <Link href="/registrera" className="underline hover:text-foreground">
            Registrera dig
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
