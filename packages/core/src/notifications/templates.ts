// Plantillas de correo v1 (DOC3 §4): registro en código con variables SIEMPRE
// escapadas (patrón esc de ADEC). Los módulos registran las suyas vía
// registerTemplate; el theming por tenant/Unit llega con branding (units.theme).
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export type TemplateVariables = Record<string, string>;
export type TemplateRenderer = (vars: TemplateVariables) => RenderedEmail;

const registry = new Map<string, TemplateRenderer>();

export function registerTemplate(key: string, renderer: TemplateRenderer): void {
  if (registry.has(key)) throw new Error(`Plantilla duplicada: "${key}"`);
  registry.set(key, renderer);
}

export function renderTemplate(key: string, vars: TemplateVariables): RenderedEmail {
  const renderer = registry.get(key);
  if (!renderer) throw new Error(`Plantilla no registrada: "${key}"`);
  return renderer(vars);
}

/** Layout base minimalista (tablas + estilos inline, patrón email de ADEC). */
export function emailLayout(title: string, contentHtml: string): string {
  return (
    `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:sans-serif">` +
    `<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px">` +
    `<tr><td style="padding:20px 24px;border-bottom:1px solid #e4e4e7">` +
    `<strong style="font-size:16px">${escapeHtml(title)}</strong></td></tr>` +
    `<tr><td style="padding:20px 24px;font-size:14px;color:#3f3f46">${contentHtml}</td></tr>` +
    `<tr><td style="padding:12px 24px;font-size:11px;color:#a1a1aa;border-top:1px solid #e4e4e7">` +
    `Plataforma ____ · notificación automática</td></tr>` +
    `</table></body></html>`
  );
}

// --- Plantillas del Core -----------------------------------------------------

registerTemplate("core.job_failed", (vars) => {
  const tenant = escapeHtml(vars["tenantName"] ?? "");
  const kind = escapeHtml(vars["jobKind"] ?? "");
  const error = escapeHtml(vars["error"] ?? "");
  return {
    subject: `⚠️ Trabajo fallido: ${vars["jobKind"] ?? ""}`,
    html: emailLayout(
      "Trabajo en segundo plano fallido",
      `<p>Un trabajo de <strong>${tenant}</strong> agotó sus reintentos y quedó marcado como fallido.</p>` +
        `<p><strong>Tipo:</strong> <code>${kind}</code><br>` +
        `<strong>Último error:</strong> ${error}</p>` +
        `<p>Revisa la bitácora del job en el panel para más detalle.</p>`,
    ),
  };
});
