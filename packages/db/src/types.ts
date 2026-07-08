// ============================================================================
// Tipos de la base de datos (esquema public) — formato `supabase gen types`.
// ----------------------------------------------------------------------------
// ESCRITOS A MANO contra el esquema real (information_schema, 2026-07-08)
// porque `supabase gen types --db-url` requiere Docker y esta máquina no lo
// tiene. En cuanto exista SUPABASE_ACCESS_TOKEN (PAT de la cuenta), sustituir
// por:  supabase gen types typescript --project-id ehllkqxrgkexlhrswotk
//        > packages/db/src/types.ts
// Regla: cada migración que cambie el esquema regenera (o actualiza) esto.
// ============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      domain_events: {
        Row: {
          id: string;
          tenant_id: string;
          event_key: string;
          entity_type: string;
          entity_id: string | null;
          payload: Json;
          actor_kind: string;
          actor_id: string | null;
          version: number;
          occurred_at: string;
          processed_at: string | null;
          attempts: number;
          last_error: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          event_key: string;
          entity_type: string;
          entity_id?: string | null;
          payload?: Json;
          actor_kind?: string;
          actor_id?: string | null;
          version?: number;
          occurred_at?: string;
          processed_at?: string | null;
          attempts?: number;
          last_error?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          event_key?: string;
          entity_type?: string;
          entity_id?: string | null;
          payload?: Json;
          actor_kind?: string;
          actor_id?: string | null;
          version?: number;
          occurred_at?: string;
          processed_at?: string | null;
          attempts?: number;
          last_error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "domain_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      job_events: {
        Row: {
          id: string;
          job_id: string;
          at: string;
          type: string;
          detail: Json;
        };
        Insert: {
          id?: string;
          job_id: string;
          at?: string;
          type: string;
          detail?: Json;
        };
        Update: {
          id?: string;
          job_id?: string;
          at?: string;
          type?: string;
          detail?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          tenant_id: string;
          kind: string;
          payload: Json;
          status: string;
          scheduled_for: string;
          attempts: number;
          max_attempts: number;
          dedupe_key: string | null;
          last_error: string | null;
          cost_cents: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          kind: string;
          payload?: Json;
          status?: string;
          scheduled_for?: string;
          attempts?: number;
          max_attempts?: number;
          dedupe_key?: string | null;
          last_error?: string | null;
          cost_cents?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          kind?: string;
          payload?: Json;
          status?: string;
          scheduled_for?: string;
          attempts?: number;
          max_attempts?: number;
          dedupe_key?: string | null;
          last_error?: string | null;
          cost_cents?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role_id: string;
          kind: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role_id: string;
          kind?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role_id?: string;
          kind?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_key: string;
        };
        Insert: {
          role_id: string;
          permission_key: string;
        };
        Update: {
          role_id?: string;
          permission_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          id: string;
          tenant_id: string;
          key: string;
          name: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          key: string;
          name: string;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          key?: string;
          name?: string;
          is_system?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_counters: {
        Row: {
          tenant_id: string;
          key: string;
          value: number;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          key: string;
          value?: number;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          key?: string;
          value?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_modules: {
        Row: {
          tenant_id: string;
          module_key: string;
          status: string;
          config: Json;
          activated_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          module_key: string;
          status?: string;
          config?: Json;
          activated_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          module_key?: string;
          status?: string;
          config?: Json;
          activated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          plan: string;
          status: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          plan?: string;
          status?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          plan?: string;
          status?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          tenant_id: string;
          slug: string;
          name: string;
          theme: Json;
          settings: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          slug: string;
          name: string;
          theme?: Json;
          settings?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          slug?: string;
          name?: string;
          theme?: Json;
          settings?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          locale: string;
          active_tenant_id: string | null;
          is_platform_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          active_tenant_id?: string | null;
          is_platform_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          active_tenant_id?: string | null;
          is_platform_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_active_tenant_id_fkey";
            columns: ["active_tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_jobs: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["jobs"]["Row"][];
      };
      custom_access_token_hook: {
        Args: { event: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database["public"];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
