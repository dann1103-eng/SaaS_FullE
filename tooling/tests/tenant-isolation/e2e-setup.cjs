// Setup e2e Sesión 2: usuario real con DOS tenants (Alfa activo, Beta para el
// switcher). Imprime credenciales e IDs. Limpieza: e2e-teardown.cjs.
const { Client } = require("pg");
const { randomUUID } = require("node:crypto");

const URL_BASE = process.env.SB_URL;
const SERVICE = process.env.SB_SERVICE;

async function api(path, method, body) {
  const r = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `e2e-s2-${suffix}@example.com`;
  const password = `E2e-${randomUUID()}`;
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const user = await api("/auth/v1/admin/users", "POST", { email, password, email_confirm: true });

  async function provision(name, slug) {
    const t = await pg.query("insert into public.tenants (slug, name) values ($1, $2) returning id", [slug, name]);
    const tenantId = t.rows[0].id;
    const r = await pg.query(
      "insert into public.roles (tenant_id, key, name, is_system) values ($1,'owner','Propietario',true) returning id",
      [tenantId],
    );
    await pg.query("insert into public.role_permissions (role_id, permission_key) values ($1,'*')", [r.rows[0].id]);
    await pg.query(
      "insert into public.memberships (tenant_id, user_id, role_id, kind, status) values ($1,$2,$3,'staff','active')",
      [tenantId, user.id, r.rows[0].id],
    );
    return tenantId;
  }

  const alfa = await provision(`E2E Alfa ${suffix}`, `e2e-alfa-${suffix}`);
  const beta = await provision(`E2E Beta ${suffix}`, `e2e-beta-${suffix}`);
  await pg.query("update public.users set active_tenant_id = $1 where id = $2", [alfa, user.id]);

  console.log(JSON.stringify({ email, password, userId: user.id, alfa, beta, suffix }, null, 2));
  await pg.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
