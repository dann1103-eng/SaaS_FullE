// ============================================================================
// CONTRATOS DE C5: notifications + notification_deliveries (migración 0004)
// + watchdog de claim_jobs. Regla 10 de CLAUDE.md. Rollback total.
// ============================================================================

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DbHarness, dbUrl } from "./harness";

let h: DbHarness;
let userA = "";
let userA2 = ""; // segundo miembro del MISMO tenant (el feed es por usuario)
let userB = "";
let tenantA = "";
let roleA = "";
let tenantB = "";

describe.runIf(Boolean(dbUrl))("C5: notificaciones (migración 0004)", () => {
  beforeAll(async () => {
    h = await DbHarness.open();
    userA = await h.addAuthUser();
    userA2 = await h.addAuthUser();
    userB = await h.addAuthUser();
    ({ tenantId: tenantA, roleId: roleA } = await h.addTenantWithOwner(userA, "n-a"));
    ({ tenantId: tenantB } = await h.addTenantWithOwner(userB, "n-b"));
    // userA2 como segundo miembro activo de tenantA (mismo rol owner)
    await h.client.query(
      `insert into public.memberships (tenant_id, user_id, role_id, kind, status)
       values ($1, $2, $3, 'staff', 'active')`,
      [tenantA, userA2, roleA],
    );
  });

  afterAll(async () => {
    await h.close();
  });

  it("el feed lo escriben los productores (runner), no los usuarios (42501)", async () => {
    await h.asUser(userA, tenantA);
    await h.expectSqlError(
      `insert into public.notifications (tenant_id, user_id, type, title)
       values ($1, $2, 'core.job_failed', 'Intruso')`,
      [tenantA, userA],
      "42501",
    );
  });

  it("cada usuario ve SOLO su feed, incluso dentro del mismo tenant", async () => {
    await h.asOwner();
    await h.client.query(
      `insert into public.notifications (tenant_id, user_id, type, title, body)
       values ($1, $2, 'core.job_failed', 'Trabajo fallido: demo', 'detalle')`,
      [tenantA, userA],
    );

    await h.asUser(userA, tenantA);
    const own = await h.client.query(`select id from public.notifications`);
    expect(own.rowCount).toBe(1);

    await h.asUser(userA2, tenantA); // mismo tenant, otro usuario
    const sameTenant = await h.client.query(`select id from public.notifications`);
    expect(sameTenant.rowCount).toBe(0);

    await h.asUser(userB, tenantB);
    const cross = await h.client.query(`select id from public.notifications`);
    expect(cross.rowCount).toBe(0);
  });

  it("marcar leído: el dueño puede (solo read_at); otro usuario afecta 0 filas; otra columna es 42501", async () => {
    await h.asUser(userA2, tenantA);
    const foreign = await h.client.query(
      `update public.notifications set read_at = now() where user_id = $1`,
      [userA],
    );
    expect(foreign.rowCount).toBe(0);

    await h.asUser(userA, tenantA);
    const own = await h.client.query(
      `update public.notifications set read_at = now() where user_id = $1 returning read_at`,
      [userA],
    );
    expect(own.rowCount).toBe(1);

    await h.expectSqlError(
      `update public.notifications set title = 'hackeado' where user_id = $1`,
      [userA],
      "42501", // grant de COLUMNA: solo read_at es actualizable
    );
  });

  it("deliveries: reservar propio ok; duplicado exacto 23505 (ADR-001); tenant ajeno 42501", async () => {
    await h.asUser(userA, tenantA);
    const jobRef = `job:${randomUUID()}`;
    const ok = await h.client.query(
      `insert into public.notification_deliveries (tenant_id, channel, template_key, recipient, entity_ref)
       values ($1, 'email', 'core.job_failed', 'admin@demo.test', $2) returning id`,
      [tenantA, jobRef],
    );
    expect(ok.rowCount).toBe(1);

    await h.expectSqlError(
      `insert into public.notification_deliveries (tenant_id, channel, template_key, recipient, entity_ref)
       values ($1, 'email', 'core.job_failed', 'admin@demo.test', $2)`,
      [tenantA, jobRef],
      "23505",
    );

    await h.expectSqlError(
      `insert into public.notification_deliveries (tenant_id, channel, template_key, recipient, entity_ref)
       values ($1, 'email', 'core.job_failed', 'admin@demo.test', 'job:x')`,
      [tenantB],
      "42501",
    );
  });

  it("deliveries: los estados los muta solo el runner (update de authenticated es 42501)", async () => {
    await h.asUser(userA, tenantA);
    await h.expectSqlError(
      `update public.notification_deliveries set status = 'sent' where tenant_id = $1`,
      [tenantA],
      "42501",
    );
  });

  it("deliveries: un tenant no ve las entregas del otro", async () => {
    await h.asUser(userB, tenantB);
    const cross = await h.client.query(
      `select id from public.notification_deliveries where tenant_id = $1`,
      [tenantA],
    );
    expect(cross.rowCount).toBe(0);
  });

  it("watchdog: un job estancado en running >10 min vuelve a ser reclamable", async () => {
    await h.asOwner();
    const stale = await h.client.query(
      `insert into public.jobs (tenant_id, kind, status, updated_at, scheduled_for)
       values ($1, 'core.noop', 'running', now() - interval '11 minutes', now() - interval '11 minutes')
       returning id`,
      [tenantA],
    );
    const staleId = (stale.rows[0] as { id: string }).id;

    await h.asServiceRole();
    const claimed = await h.client.query(`select id, status, last_error from public.claim_jobs(50)`);
    const reclaimed = claimed.rows.find((r: { id: string }) => r.id === staleId) as
      | { id: string; status: string; last_error: string | null }
      | undefined;
    expect(reclaimed).toBeDefined();
    expect(reclaimed?.status).toBe("running");
    expect(reclaimed?.last_error).toContain("watchdog");
  });
});
