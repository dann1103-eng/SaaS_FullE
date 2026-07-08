import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Plataforma ____",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Plataforma ____</h1>
        <p className="mt-1 text-sm text-neutral-500">Inicia sesión para continuar</p>
      </div>
      <LoginForm />
    </main>
  );
}
