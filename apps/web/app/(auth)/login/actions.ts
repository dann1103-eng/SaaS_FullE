"use server";

import { redirect } from "next/navigation";
import * as z from "zod";

import { supabaseServer } from "@/lib/supabase/server";

const LoginSchema = z.object({
  email: z.email({ error: "Ingresa un correo válido." }),
  password: z.string().min(1, { error: "La contraseña es obligatoria." }),
});

export type LoginState =
  | {
      errors?: { email?: string[]; password?: string[] };
      message?: string;
    }
  | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensaje genérico a propósito: no revelar si el correo existe.
    return { message: "Credenciales inválidas." };
  }

  redirect("/");
}
