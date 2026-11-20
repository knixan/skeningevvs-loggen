import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoggaInPage() {
  // Redan inloggad med en giltig session → direkt till Mina sidor.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/mina-sidor");

  return (
    <main className="flex flex-1 items-center justify-center bg-page px-4 py-16">
      <LoginForm />
    </main>
  );
}
