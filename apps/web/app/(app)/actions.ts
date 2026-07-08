"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { supabaseServer } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

const SwitchTenantSchema = z.object({
  tenantId: z.uuid({ error: "Tenant inválido." }),
});

export async function switchTenant(formData: FormData) {
  const parsed = SwitchTenantSchema.safeParse({ tenantId: formData.get("tenantId") });
  if (!parsed.success) return;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Guard de membresía (mejor UX). La defensa final es el hook JWT: un
  // active_tenant_id sin membresía activa jamás produce claim (migración 0001 §9).
  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", parsed.data.tenantId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return;

  const { error } = await supabase
    .from("users")
    .update({ active_tenant_id: parsed.data.tenantId })
    .eq("id", user.id);
  if (error) return;

  // Re-emitir el JWT para que el hook inyecte el claim del nuevo tenant
  // (paso obligatorio documentado en la migración 0001).
  await supabase.auth.refreshSession();

  revalidatePath("/", "layout");
  redirect("/");
}
