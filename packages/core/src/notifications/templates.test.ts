// Registro de plantillas tipadas (DOC3 §4 v1). Variables SIEMPRE escapadas
// (esc anti-XSS, patrón ADEC template.ts). Clave desconocida = error fuerte.
import { describe, expect, it } from "vitest";

import { escapeHtml, renderTemplate } from "./templates";

describe("escapeHtml (patrón esc de ADEC)", () => {
  it("neutraliza los cinco caracteres peligrosos", () => {
    expect(escapeHtml(`<script>alert("x&y")</script>'`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;&#39;",
    );
  });
});

describe("renderTemplate", () => {
  it("core.job_failed: subject y html con las variables interpoladas", () => {
    const out = renderTemplate("core.job_failed", {
      tenantName: "Demo A",
      jobKind: "m08.daily-billing",
      error: "timeout de pasarela",
    });
    expect(out.subject).toContain("m08.daily-billing");
    expect(out.html).toContain("Demo A");
    expect(out.html).toContain("timeout de pasarela");
    expect(out.html).toMatch(/<body[\s>]/); // documento completo para inyectar banner
  });

  it("escapa variables hostiles en el html", () => {
    const out = renderTemplate("core.job_failed", {
      tenantName: "<img src=x onerror=alert(1)>",
      jobKind: "core.noop",
      error: "a & b",
    });
    expect(out.html).not.toContain("<img src=x");
    expect(out.html).toContain("&lt;img src=x");
    expect(out.html).toContain("a &amp; b");
  });

  it("clave desconocida: error con la clave en el mensaje", () => {
    expect(() => renderTemplate("m99.no_existe", {})).toThrow(/m99\.no_existe/);
  });
});
