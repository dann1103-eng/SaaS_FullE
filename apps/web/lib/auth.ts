// DAL de autenticación (patrón de la guía de auth de Next): verificación
// centralizada y cacheada por request. Las páginas protegidas llaman esto.
import { AuthenticationError, getAuthContext } from "@plataforma/core";
import { redirect } from "next/navigation";
import { cache } from "react";

import { supabaseServer } from "./supabase/server";

export const requireAuth = cache(async () => {
  const supabase = await supabaseServer();
  try {
    const ctx = await getAuthContext(supabase);
    return { supabase, ...ctx };
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    throw error;
  }
});
