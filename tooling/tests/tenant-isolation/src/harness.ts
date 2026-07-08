// Harness compartido de las suites de aislamiento/contratos de BD.
// Conecta como dueño de las tablas y simula el contexto PostgREST con
// `set local role` + `request.jwt.claims`. TODO dentro de una transacción
// que se revierte al cerrar: cero residuo, seguro contra el proyecto real.
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect } from "vitest";

export const dbUrl = process.env["SUPABASE_DB_URL"];

export interface TenantFixture {
  tenantId: string;
  roleId: string;
}

export class DbHarness {
  private constructor(readonly client: Client) {}

  static async open(): Promise<DbHarness> {
    if (!dbUrl) throw new Error("SUPABASE_DB_URL no definido");
    const isLocal = /127\.0\.0\.1|localhost/.test(dbUrl);
    const client = new Client({
      connectionString: dbUrl,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query("begin");
    return new DbHarness(client);
  }

  /** Revierte TODO y cierra la conexión (cero residuo). */
  async close(): Promise<void> {
    await this.client.query("rollback").catch(() => undefined);
    await this.client.end().catch(() => undefined);
  }

  /** Simula un usuario autenticado de PostgREST (claims del JWT). */
  async asUser(userId: string, tenantClaim: string | null): Promise<void> {
    await this.client.query("set local role authenticated");
    const claims: Record<string, string> = { sub: userId, role: "authenticated" };
    if (tenantClaim) claims["tenant_id"] = tenantClaim;
    await this.setClaims(claims);
  }

  /** Simula el runner (service_role vía claims; el rol pg queda como dueño). */
  async asServiceRole(): Promise<void> {
    await this.client.query("reset role");
    await this.setClaims({ role: "service_role" });
  }

  async asAnon(): Promise<void> {
    await this.client.query("set local role anon");
    await this.setClaims({ role: "anon" });
  }

  /** Dueño de las tablas: bypass RLS — solo fixtures y controles. */
  async asOwner(): Promise<void> {
    await this.client.query("reset role");
    await this.setClaims({});
  }

  private async setClaims(claims: Record<string, string>): Promise<void> {
    await this.client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
  }

  /** Ejecuta esperando un error SQL concreto, sin abortar la transacción. */
  async expectSqlError(sql: string, params: unknown[], expectedCode: string): Promise<void> {
    await this.client.query("savepoint expected_error");
    let code: string | undefined;
    try {
      await this.client.query(sql, params);
    } catch (error) {
      code = (error as { code?: string }).code;
    }
    await this.client.query("rollback to savepoint expected_error");
    expect(code, `se esperaba error ${expectedCode} y la sentencia fue permitida`).toBe(
      expectedCode,
    );
  }

  /** Crea un usuario en auth.users (el trigger crea el perfil). Como dueño. */
  async addAuthUser(): Promise<string> {
    const id = randomUUID();
    await this.client.query(
      `insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, now(), now())`,
      [id, `iso-${id}@test.local`],
    );
    return id;
  }

  /** Tenant + rol owner('*') + membresía activa + tenant activo del usuario. */
  async addTenantWithOwner(userId: string, label: string): Promise<TenantFixture> {
    const suffix = randomUUID().slice(0, 8);
    const t = await this.client.query(
      `insert into public.tenants (slug, name) values ($1, $2) returning id`,
      [`iso-${label}-${suffix}`, `Iso ${label} ${suffix}`],
    );
    const tenantId = (t.rows[0] as { id: string }).id;
    const r = await this.client.query(
      `insert into public.roles (tenant_id, key, name, is_system)
       values ($1, 'owner', 'Propietario', true) returning id`,
      [tenantId],
    );
    const roleId = (r.rows[0] as { id: string }).id;
    await this.client.query(
      `insert into public.role_permissions (role_id, permission_key) values ($1, '*')`,
      [roleId],
    );
    await this.client.query(
      `insert into public.memberships (tenant_id, user_id, role_id, kind, status)
       values ($1, $2, $3, 'staff', 'active')`,
      [tenantId, userId, roleId],
    );
    await this.client.query(`update public.users set active_tenant_id = $1 where id = $2`, [
      tenantId,
      userId,
    ]);
    return { tenantId, roleId };
  }
}
