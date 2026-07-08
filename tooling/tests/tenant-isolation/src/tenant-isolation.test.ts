// ============================================================================
// TEST DE AISLAMIENTO DE TENANTS (CLAUDE.md regla 10 · DOC3 §1.6)
// ============================================================================
// Verifica que un usuario del tenant A no puede leer/escribir filas del
// tenant B, contra la migración 0001_tenancy_foundation.
//
// Cómo funciona: se conecta a Postgres como `postgres` (dueño de las tablas)
// y simula el contexto de PostgREST con `set local role` +
// `request.jwt.claims`, exactamente igual que lo hace la API de Supabase.
// TODO ocurre dentro de una transacción que se revierte al final: correrlo
// contra el proyecto remoto no deja ningún residuo.
//
// Requiere: SUPABASE_DB_URL (conexión de SESIÓN, no pooler transaccional).
//   · Local/CI:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   · Remoto:    session pooler del Dashboard (puerto 5432)
// Sin la variable, la suite se omite limpiamente (turbo test local pasa).
//
// Cada tabla nueva de migraciones futuras debe añadir aquí sus asserts
// (CLAUDE.md regla 10).
// ============================================================================

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbUrl = process.env["SUPABASE_DB_URL"];
if (!dbUrl) {
  console.warn(
    "[tenant-isolation] SUPABASE_DB_URL no definido — suite omitida (defínela para correr el test)",
  );
}

// Fixture (los UUID se generan por corrida; la transacción se revierte al final)
const userA = randomUUID();
const userB = randomUUID();
const userC = randomUUID(); // para provision_tenant
const tenantA = randomUUID();
const tenantB = randomUUID();
const roleA = randomUUID();
const roleB = randomUUID();

let client: Client;

/** Simula el contexto de un usuario autenticado de PostgREST. */
async function asUser(userId: string, tenantClaim: string | null): Promise<void> {
  await client.query("set local role authenticated");
  const claims: Record<string, string> = { sub: userId, role: "authenticated" };
  if (tenantClaim) claims["tenant_id"] = tenantClaim;
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(claims),
  ]);
}

/** Contexto anónimo (rol anon, sin claims). */
async function asAnon(): Promise<void> {
  await client.query("set local role anon");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ role: "anon" }),
  ]);
}

/** Vuelve al dueño de las tablas (bypassa RLS — solo para fixture y controles). */
async function asOwner(): Promise<void> {
  await client.query("reset role");
}

/** Ejecuta una sentencia esperando un error SQL, sin abortar la transacción. */
async function expectSqlError(
  sql: string,
  params: unknown[],
  expectedCode: string,
): Promise<void> {
  await client.query("savepoint expected_error");
  let code: string | undefined;
  try {
    await client.query(sql, params);
  } catch (error) {
    code = (error as { code?: string }).code;
  }
  await client.query("rollback to savepoint expected_error");
  expect(code, `se esperaba error ${expectedCode} y la sentencia fue permitida`).toBe(
    expectedCode,
  );
}

describe.runIf(Boolean(dbUrl))("aislamiento de tenants (migración 0001)", () => {
  beforeAll(async () => {
    const isLocal = /127\.0\.0\.1|localhost/.test(dbUrl ?? "");
    client = new Client({
      connectionString: dbUrl,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query("begin");

    // Fixture como dueño: usuarios de auth (el trigger crea public.users),
    // dos tenants con rol owner('*'), membresías y tenant activo.
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, now(), now()),
              ('00000000-0000-0000-0000-000000000000', $3, 'authenticated', 'authenticated', $4, now(), now()),
              ('00000000-0000-0000-0000-000000000000', $5, 'authenticated', 'authenticated', $6, now(), now())`,
      [userA, `iso-a-${userA}@test.local`, userB, `iso-b-${userB}@test.local`, userC, `iso-c-${userC}@test.local`],
    );
    await client.query(
      `insert into public.tenants (id, slug, name)
       values ($1, $2, 'Iso Tenant A'), ($3, $4, 'Iso Tenant B')`,
      [tenantA, `iso-a-${tenantA.slice(0, 8)}`, tenantB, `iso-b-${tenantB.slice(0, 8)}`],
    );
    await client.query(
      `insert into public.roles (id, tenant_id, key, name, is_system)
       values ($1, $2, 'owner', 'Propietario', true), ($3, $4, 'owner', 'Propietario', true)`,
      [roleA, tenantA, roleB, tenantB],
    );
    await client.query(
      `insert into public.role_permissions (role_id, permission_key) values ($1, '*'), ($2, '*')`,
      [roleA, roleB],
    );
    await client.query(
      `insert into public.memberships (tenant_id, user_id, role_id, kind, status)
       values ($1, $2, $3, 'staff', 'active'), ($4, $5, $6, 'staff', 'active')`,
      [tenantA, userA, roleA, tenantB, userB, roleB],
    );
    await client.query(`update public.users set active_tenant_id = $1 where id = $2`, [tenantA, userA]);
    await client.query(`update public.users set active_tenant_id = $1 where id = $2`, [tenantB, userB]);
  });

  afterAll(async () => {
    // Nada persiste: ni local ni remoto.
    await client.query("rollback").catch(() => undefined);
    await client.end().catch(() => undefined);
  });

  it("control negativo: el dueño de las tablas ve ambos tenants (el test no es vacuo)", async () => {
    await asOwner();
    const r = await client.query(`select id from public.tenants where id in ($1, $2)`, [tenantA, tenantB]);
    expect(r.rowCount).toBe(2);
  });

  it("cada usuario ve exactamente su tenant y no el ajeno", async () => {
    await asUser(userA, tenantA);
    const a = await client.query(`select id from public.tenants`);
    expect(a.rows.map((row: { id: string }) => row.id)).toEqual([tenantA]);

    const crossRead = await client.query(`select id from public.tenants where id = $1`, [tenantB]);
    expect(crossRead.rowCount).toBe(0);

    await asUser(userB, tenantB);
    const b = await client.query(`select id from public.tenants`);
    expect(b.rows.map((row: { id: string }) => row.id)).toEqual([tenantB]);
  });

  it("authenticated sin membresías y anon ven 0 tenants", async () => {
    await asUser(randomUUID(), null);
    const noMember = await client.query(`select id from public.tenants`);
    expect(noMember.rowCount).toBe(0);

    await asAnon();
    const anon = await client.query(`select id from public.tenants`);
    expect(anon.rowCount).toBe(0);
  });

  it("insertar en el propio tenant funciona; en el ajeno viola RLS (42501)", async () => {
    await asUser(userA, tenantA);
    const ok = await client.query(
      `insert into public.units (tenant_id, slug, name) values ($1, 'iso-unit', 'Unidad propia') returning id`,
      [tenantA],
    );
    expect(ok.rowCount).toBe(1);

    await expectSqlError(
      `insert into public.units (tenant_id, slug, name) values ($1, 'iso-intrusa', 'Unidad ajena')`,
      [tenantB],
      "42501",
    );
  });

  it("un claim tenant_id falsificado no otorga acceso sin membresía real", async () => {
    // A presenta un JWT manipulado que dice tenant_id = tenant de B
    await asUser(userA, tenantB);
    const tenants = await client.query(`select id from public.tenants where id = $1`, [tenantB]);
    expect(tenants.rowCount).toBe(0); // lectura sigue guiada por membresía

    await expectSqlError(
      `insert into public.units (tenant_id, slug, name) values ($1, 'iso-forjada', 'Con claim forjado')`,
      [tenantB],
      "42501", // has_permission exige membresía activa en el tenant del claim
    );

    const memberships = await client.query(`select id from public.memberships where tenant_id = $1`, [tenantB]);
    expect(memberships.rowCount).toBe(0);
  });

  it("memberships y users solo muestran lo compartido por tenant", async () => {
    await asUser(userA, tenantA);
    const m = await client.query(`select tenant_id from public.memberships`);
    expect(m.rows).toEqual([{ tenant_id: tenantA }]);

    const visibleUsers = await client.query(`select id from public.users where id in ($1, $2)`, [userA, userB]);
    expect(visibleUsers.rows.map((row: { id: string }) => row.id)).toEqual([userA]);
  });

  it("next_counter: secuencia propia correlativa; tenant ajeno rechazado (42501)", async () => {
    await asUser(userA, tenantA);
    const first = await client.query(`select app.next_counter($1, 'iso_folio') as v`, [tenantA]);
    const second = await client.query(`select app.next_counter($1, 'iso_folio') as v`, [tenantA]);
    expect(Number(first.rows[0]?.v)).toBe(1);
    expect(Number(second.rows[0]?.v)).toBe(2);

    await expectSqlError(`select app.next_counter($1, 'iso_folio')`, [tenantB], "42501");
  });

  it("tenant_counters no es accesible por API (RLS sin políticas)", async () => {
    await asUser(userA, tenantA);
    const direct = await client.query(`select * from public.tenant_counters where tenant_id = $1`, [tenantA]);
    expect(direct.rowCount).toBe(0); // existe (lo escribió next_counter) pero RLS lo oculta

    await asOwner();
    const owner = await client.query(
      `select value from public.tenant_counters where tenant_id = $1 and key = 'iso_folio'`,
      [tenantA],
    );
    expect(Number(owner.rows[0]?.value)).toBe(2);
  });

  it("provision_tenant crea tenant + rol owner(*) + membresía y activa core", async () => {
    await asUser(userC, null);
    const provisioned = await client.query(`select app.provision_tenant('Iso Provisionado', $1) as id`, [
      `iso-prov-${userC.slice(0, 8)}`,
    ]);
    const newTenant = (provisioned.rows[0] as { id: string }).id;

    // Con el claim del nuevo tenant, C lo ve y su contador funciona
    await asUser(userC, newTenant);
    const visible = await client.query(`select id from public.tenants`);
    expect(visible.rows.map((row: { id: string }) => row.id)).toEqual([newTenant]);

    await asOwner();
    const wiring = await client.query(
      `select
         (select count(*) from public.roles r where r.tenant_id = $1 and r.key = 'owner' and r.is_system) as roles,
         (select count(*) from public.memberships m where m.tenant_id = $1 and m.user_id = $2 and m.status = 'active') as members,
         (select count(*) from public.tenant_modules tm where tm.tenant_id = $1 and tm.module_key = 'core' and tm.status = 'active') as core_on,
         (select u.active_tenant_id from public.users u where u.id = $2) as active_tenant`,
      [newTenant, userC],
    );
    const w = wiring.rows[0] as { roles: string; members: string; core_on: string; active_tenant: string };
    expect(Number(w.roles)).toBe(1);
    expect(Number(w.members)).toBe(1);
    expect(Number(w.core_on)).toBe(1);
    expect(w.active_tenant).toBe(newTenant);
  });
});
