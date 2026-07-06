import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default function RegistreraPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <RegisterForm />
    </main>
  );
}
