// Mecánica TEST_MODE cosechada de TAS (lib/sendEmail.ts): redirigir el
// destinatario, anular CC, conservar el subject y inyectar un banner HTML
// tras <body> que documenta a quién iba dirigido originalmente.
import { describe, expect, it } from "vitest";

import { applyTestMode, type OutgoingEmail } from "./test-mode";

const base: OutgoingEmail = {
  to: "cliente@empresa.com",
  cc: "supervisor@empresa.com",
  subject: "Factura F-0001",
  html: "<html><body><p>Hola</p></body></html>",
};

describe("applyTestMode (patrón TAS)", () => {
  it("desactivado: pasa el mensaje intacto", () => {
    const out = applyTestMode(base, { enabled: false, redirectTo: "qa@test.com" });
    expect(out).toEqual(base);
  });

  it("activado: redirige el destinatario, anula CC y conserva el subject", () => {
    const out = applyTestMode(base, { enabled: true, redirectTo: "qa@test.com" });
    expect(out.to).toBe("qa@test.com");
    expect(out.cc).toBeUndefined();
    expect(out.subject).toBe("Factura F-0001"); // intacto para verificar contenido
  });

  it("activado: inyecta el banner justo después de <body> con los destinatarios originales", () => {
    const out = applyTestMode(base, { enabled: true, redirectTo: "qa@test.com" });
    const bodyIdx = out.html.indexOf("<body>");
    const bannerIdx = out.html.indexOf("MODO PRUEBA");
    expect(bannerIdx).toBeGreaterThan(bodyIdx);
    expect(bannerIdx).toBeLessThan(out.html.indexOf("<p>Hola</p>"));
    expect(out.html).toContain("cliente@empresa.com");
    expect(out.html).toContain("supervisor@empresa.com");
  });

  it("sin etiqueta <body>: antepone el banner al inicio", () => {
    const out = applyTestMode(
      { ...base, html: "<p>Sin body</p>" },
      { enabled: true, redirectTo: "qa@test.com" },
    );
    expect(out.html.startsWith("<table")).toBe(true);
    expect(out.html).toContain("<p>Sin body</p>");
  });

  it("con testLabel: el banner usa la etiqueta en vez de la lista de destinatarios", () => {
    const out = applyTestMode(base, {
      enabled: true,
      redirectTo: "qa@test.com",
      label: "Admin del tenant Demo (admin@demo.com)",
    });
    expect(out.html).toContain("Admin del tenant Demo");
  });

  it("activado sin redirectTo: lanza (configuración inválida, no enviar a nadie real)", () => {
    expect(() => applyTestMode(base, { enabled: true, redirectTo: "" })).toThrow(/redirect/i);
  });
});
