// ============================================================================
// CONTRATOS DE C4: domain_events + jobs + job_events (migración 0002)
// ============================================================================
// Amplía el test de aislamiento (CLAUDE.md regla 10) con las tablas nuevas:
// outbox append-only por API, cola con dedupe único, claim solo service_role.
// Misma mecánica del harness: transacción con rollback, cero residuo.
// ============================================================================

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DbHarness, dbUrl } from "./harness";

let h: DbHarness;
let userA = "";
let userB = "";
let tenantA = "";
let tenantB = "";

describe.runIf(Boolean(dbUrl))("C4: eventos y jobs (migración 0002)", () => {
  beforeAll(async () => {
    h = await DbHarness.open();
    userA = await h.addAuthUser();
    userB = await h.addAuthUser();
    ({ tenantId: tenantA } = await h.addTenantWithOwner(userA, "ev-a"));
    ({ tenantId: tenantB } = await h.addTenantWithOwner(userB, "ev-b"));
  });

  afterAll(async () => {
    await h.close();
  });

  it("emitir evento en el propio tenant funciona; la clave inválida la corta el CHECK (23514)", async () => {
    await h.asUser(userA, tenantA);
    const ok = await h.client.query(
      `insert into public.domain_events (tenant_id, event_key, entity_type, entity_id)
       values ($1, 'm01.account.created', 'account', $2) returning id`,
      [tenantA, randomUUID()],
    );
    expect(ok.rowCount).toBe(1);

    await h.expectSqlError(
      `insert into public.domain_events (tenant_id, event_key, entity_type)
       values ($1, 'clave.rota', 'account')`,
      [tenantA],
      "23514",
    );
  });

  it("no se puede emitir en un tenant ajeno (42501), ni directo ni vía app.emit_domain_event", async () => {
    await h.asUser(userA, tenantA);
    await h.expectSqlError(
      `insert into public.domain_events (tenant_id, event_key, entity_type)
       values ($1, 'm01.account.created', 'account')`,
      [tenantB],
      "42501",
    );
    await h.expectSqlError(
      `select app.emit_domain_event($1, 'm01.account.created', 'account', null)`,
      [tenantB],
      "42501",
    );
  });

  it("app.emit_domain_event emite con membresía válida y captura el actor", async () => {
    await h.asUser(userA, tenantA);
    const r = await h.client.query(
      `select app.emit_domain_event($1, 'core.tenant.created', 'tenant', $1, '{"origen":"test"}'::jsonb, 'user') as id`,
      [tenantA],
    );
    const eventId = (r.rows[0] as { id: string }).id;

    await h.asOwner();
    const row = await h.client.query(
      `select actor_id, payload->>'origen' as origen from public.domain_events where id = $1`,
      [eventId],
    );
    expect(row.rows[0]).toEqual({ actor_id: userA, origen: "test" });
  });

  it("el outbox es append-only por API: update de authenticated es 42501 explícito", async () => {
    // Migración 0003: sin grant de update (revocado también sobre los default
    // privileges de hosted) — el intento falla fuerte, no es un no-op.
    await h.asUser(userA, tenantA);
    await h.expectSqlError(
      `update public.domain_events set processed_at = now() where tenant_id = $1`,
      [tenantA],
      "42501",
    );

    await h.asOwner();
    const still = await h.client.query(
      `select count(*)::int as pendientes from public.domain_events
       where tenant_id = $1 and processed_at is null`,
      [tenantA],
    );
    expect((still.rows[0] as { pendientes: number }).pendientes).toBeGreaterThan(0);
  });

  it("un tenant no ve los eventos del otro", async () => {
    await h.asUser(userB, tenantB);
    const cross = await h.client.query(
      `select id from public.domain_events where tenant_id = $1`,
      [tenantA],
    );
    expect(cross.rowCount).toBe(0);
  });

  it("encolar job propio funciona; el dedupe_key duplicado es 23505; el tenant ajeno 42501", async () => {
    await h.asUser(userA, tenantA);
    const ok = await h.client.query(
      `insert into public.jobs (tenant_id, kind, dedupe_key) values ($1, 'core.noop', 'iso-dedupe-1') returning id`,
      [tenantA],
    );
    expect(ok.rowCount).toBe(1);

    await h.expectSqlError(
      `insert into public.jobs (tenant_id, kind, dedupe_key) values ($1, 'core.noop', 'iso-dedupe-1')`,
      [tenantA],
      "23505",
    );

    await h.expectSqlError(
      `insert into public.jobs (tenant_id, kind) values ($1, 'core.noop')`,
      [tenantB],
      "42501",
    );
  });

  it("claim_jobs es exclusivo del runner: authenticated recibe 42501", async () => {
    await h.asUser(userA, tenantA);
    await h.expectSqlError(`select * from public.claim_jobs(5)`, [], "42501");
  });

  it("claim_jobs reclama lo vencido (running, attempts+1) y respeta scheduled_for futuro", async () => {
    // job futuro que NO debe reclamarse
    await h.asUser(userA, tenantA);
    const future = await h.client.query(
      `insert into public.jobs (tenant_id, kind, scheduled_for)
       values ($1, 'core.noop', now() + interval '1 hour') returning id`,
      [tenantA],
    );
    const futureId = (future.rows[0] as { id: string }).id;

    await h.asServiceRole();
    const claimed = await h.client.query(`select id, status, attempts from public.claim_jobs(50)`);
    const ids = claimed.rows.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(futureId);
    expect(claimed.rowCount).toBeGreaterThan(0); // el job 'iso-dedupe-1' vencido
    for (const row of claimed.rows as { status: string; attempts: number }[]) {
      expect(row.status).toBe("running");
      expect(row.attempts).toBeGreaterThanOrEqual(1);
    }

    // segundo claim: ya no hay pendientes vencidos (los reclamados están running)
    const again = await h.client.query(`select id from public.claim_jobs(50)`);
    expect(again.rowCount).toBe(0);
  });

  it("job_events: el tenant dueño lee, el ajeno no, y authenticated no escribe (42501)", async () => {
    await h.asOwner();
    const job = await h.client.query(
      `select id from public.jobs where tenant_id = $1 limit 1`,
      [tenantA],
    );
    const jobId = (job.rows[0] as { id: string }).id;
    await h.client.query(
      `insert into public.job_events (job_id, type, detail) values ($1, 'claimed', '{}'::jsonb)`,
      [jobId],
    );

    await h.asUser(userA, tenantA);
    const own = await h.client.query(`select id from public.job_events where job_id = $1`, [
      jobId,
    ]);
    expect(own.rowCount).toBeGreaterThan(0);

    await h.expectSqlError(
      `insert into public.job_events (job_id, type) values ($1, 'claimed')`,
      [jobId],
      "42501",
    );

    await h.asUser(userB, tenantB);
    const cross = await h.client.query(`select id from public.job_events where job_id = $1`, [
      jobId,
    ]);
    expect(cross.rowCount).toBe(0);
  });
});
