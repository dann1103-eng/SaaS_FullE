// ============================================================================
// TEST DE AISLAMIENTO DE TENANTS (CLAUDE.md regla 10 · DOC3 §1.6)
// ============================================================================
// Verifica que un usuario del tenant A no puede leer/escribir filas del
// tenant B, contra la migración 0001_tenancy_foundation. Ver harness.ts para
// la mecánica (simulación PostgREST + transacción con rollback, cero residuo).
//
// Requiere: SUPABASE_DB_URL (conexión de SESIÓN, no pooler transaccional).
//   · Local/CI:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   · Remoto:    session pooler del Dashboard (puerto 5432)
// Sin la variable, la suite se omite limpiamente (turbo test local pasa).
//
// Cada tabla nueva de migraciones futuras añade su suite (ver
// events-jobs.test.ts para la migración 0002).
// ============================================================================

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DbHarness, dbUrl } from "./harness";

if (!dbUrl) {
  console.warn(
    "[tenant-isolation] SUPABASE_DB_URL no definido — suite omitida (defínela para correr el test)",
  );
}

let h: DbHarness;
let userA = "";
let userB = "";
let userC = "";
let tenantA = "";
let tenantB = "";

describe.runIf(Boolean(dbUrl))("aislamiento de tenants (migración 0001)", () => {
  beforeAll(async () => {
    h = await DbHarness.open();
    userA = await h.addAuthUser();
    userB = await h.addAuthUser();
    userC = await h.addAuthUser(); // para provision_tenant
    ({ tenantId: tenantA } = await h.addTenantWithOwner(userA, "a"));
    ({ tenantId: tenantB } = await h.addTenantWithOwner(userB, "b"));
  });

  afterAll(async () => {
    await h.close();
  });

  it("control negativo: el dueño de las tablas ve ambos tenants (el test no es vacuo)", async () => {
    await h.asOwner();
    const r = await h.client.query(`select id from public.tenants where id in ($1, $2)`, [
      tenantA,
      tenantB,
    ]);
    expect(r.rowCount).toBe(2);
  });

  it("cada usuario ve exactamente su tenant y no el ajeno", async () => {
    await h.asUser(userA, tenantA);
    const a = await h.client.query(`select id from public.tenants`);
    expect(a.rows.map((row: { id: string }) => row.id)).toEqual([tenantA]);

    const crossRead = await h.client.query(`select id from public.tenants where id = $1`, [
      tenantB,
    ]);
    expect(crossRead.rowCount).toBe(0);

    await h.asUser(userB, tenantB);
    const b = await h.client.query(`select id from public.tenants`);
    expect(b.rows.map((row: { id: string }) => row.id)).toEqual([tenantB]);
  });

  it("authenticated sin membresías y anon ven 0 tenants", async () => {
    await h.asUser(randomUUID(), null);
    const noMember = await h.client.query(`select id from public.tenants`);
    expect(noMember.rowCount).toBe(0);

    await h.asAnon();
    const anon = await h.client.query(`select id from public.tenants`);
    expect(anon.rowCount).toBe(0);
  });

  it("insertar en el propio tenant funciona; en el ajeno viola RLS (42501)", async () => {
    await h.asUser(userA, tenantA);
    const ok = await h.client.query(
      `insert into public.units (tenant_id, slug, name) values ($1, 'iso-unit', 'Unidad propia') returning id`,
      [tenantA],
    );
    expect(ok.rowCount).toBe(1);

    await h.expectSqlError(
      `insert into public.units (tenant_id, slug, name) values ($1, 'iso-intrusa', 'Unidad ajena')`,
      [tenantB],
      "42501",
    );
  });

  it("un claim tenant_id falsificado no otorga acceso sin membresía real", async () => {
    // A presenta un JWT manipulado que dice tenant_id = tenant de B
    await h.asUser(userA, tenantB);
    const tenants = await h.client.query(`select id from public.tenants where id = $1`, [
      tenantB,
    ]);
    expect(tenants.rowCount).toBe(0); // lectura sigue guiada por membresía

    await h.expectSqlError(
      `insert into public.units (tenant_id, slug, name) values ($1, 'iso-forjada', 'Con claim forjado')`,
      [tenantB],
      "42501", // has_permission exige membresía activa en el tenant del claim
    );

    const memberships = await h.client.query(
      `select id from public.memberships where tenant_id = $1`,
      [tenantB],
    );
    expect(memberships.rowCount).toBe(0);
  });

  it("memberships y users solo muestran lo compartido por tenant", async () => {
    await h.asUser(userA, tenantA);
    const m = await h.client.query(`select tenant_id from public.memberships`);
    expect(m.rows).toEqual([{ tenant_id: tenantA }]);

    const visibleUsers = await h.client.query(
      `select id from public.users where id in ($1, $2)`,
      [userA, userB],
    );
    expect(visibleUsers.rows.map((row: { id: string }) => row.id)).toEqual([userA]);
  });

  it("next_counter: secuencia propia correlativa; tenant ajeno rechazado (42501)", async () => {
    await h.asUser(userA, tenantA);
    const first = await h.client.query(`select app.next_counter($1, 'iso_folio') as v`, [
      tenantA,
    ]);
    const second = await h.client.query(`select app.next_counter($1, 'iso_folio') as v`, [
      tenantA,
    ]);
    expect(Number(first.rows[0]?.v)).toBe(1);
    expect(Number(second.rows[0]?.v)).toBe(2);

    await h.expectSqlError(`select app.next_counter($1, 'iso_folio')`, [tenantB], "42501");
  });

  it("tenant_counters no es accesible por API (RLS sin políticas)", async () => {
    await h.asUser(userA, tenantA);
    const direct = await h.client.query(
      `select * from public.tenant_counters where tenant_id = $1`,
      [tenantA],
    );
    expect(direct.rowCount).toBe(0); // existe (lo escribió next_counter) pero RLS lo oculta

    await h.asOwner();
    const owner = await h.client.query(
      `select value from public.tenant_counters where tenant_id = $1 and key = 'iso_folio'`,
      [tenantA],
    );
    expect(Number(owner.rows[0]?.value)).toBe(2);
  });

  it("provision_tenant crea tenant + rol owner(*) + membresía y activa core", async () => {
    await h.asUser(userC, null);
    const provisioned = await h.client.query(
      `select app.provision_tenant('Iso Provisionado', $1) as id`,
      [`iso-prov-${userC.slice(0, 8)}`],
    );
    const newTenant = (provisioned.rows[0] as { id: string }).id;

    // Con el claim del nuevo tenant, C lo ve y su contador funciona
    await h.asUser(userC, newTenant);
    const visible = await h.client.query(`select id from public.tenants`);
    expect(visible.rows.map((row: { id: string }) => row.id)).toEqual([newTenant]);

    await h.asOwner();
    const wiring = await h.client.query(
      `select
         (select count(*) from public.roles r where r.tenant_id = $1 and r.key = 'owner' and r.is_system) as roles,
         (select count(*) from public.memberships m where m.tenant_id = $1 and m.user_id = $2 and m.status = 'active') as members,
         (select count(*) from public.tenant_modules tm where tm.tenant_id = $1 and tm.module_key = 'core' and tm.status = 'active') as core_on,
         (select u.active_tenant_id from public.users u where u.id = $2) as active_tenant`,
      [newTenant, userC],
    );
    const w = wiring.rows[0] as {
      roles: string;
      members: string;
      core_on: string;
      active_tenant: string;
    };
    expect(Number(w.roles)).toBe(1);
    expect(Number(w.members)).toBe(1);
    expect(Number(w.core_on)).toBe(1);
    expect(w.active_tenant).toBe(newTenant);
  });
});
