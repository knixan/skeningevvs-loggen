"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;

    if (password !== confirm) {
      setError("Lösenorden matchar inte.");
      return;
    }

    setLoading(true);
    const result = await signUp.email({ name, email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Registrering misslyckades.");
      return;
    }

    router.push("/mina-sidor");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Skapa konto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Namn</Label>
            <Input id="name" name="name" required placeholder="Anna Andersson" />
          </div>
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
              minLength={8}
              placeholder="Minst 8 tecken"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Bekräfta lösenord</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Skapar konto…" : "Registrera"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Har du redan ett konto?{" "}
          <Link href="/logga-in" className="underline hover:text-foreground">
            Logga in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
