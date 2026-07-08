import type { Database } from "@plataforma/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cliente tipado contra el esquema public (sirve el de usuario y el admin). */
export type DbClient = SupabaseClient<Database>;

export type DomainEventRow = Database["public"]["Tables"]["domain_events"]["Row"];
export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
