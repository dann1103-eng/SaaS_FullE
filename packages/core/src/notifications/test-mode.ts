// TEST_MODE de correos (cosecha TAS lib/sendEmail.ts, DOC3 §4): redirigir el
// destinatario a una dirección de prueba, anular CC, conservar el subject y
// inyectar un banner HTML que documenta el destinatario original.
export interface OutgoingEmail {
  to: string;
  cc?: string;
  subject: string;
  html: string;
}

export interface TestModeConfig {
  enabled: boolean;
  redirectTo: string;
  /** Descripción rica del destinatario real (nombre + motivo), opcional. */
  label?: string;
}

function banner(originalRecipients: string): string {
  return (
    `<table role="presentation" width="100%" style="background:#FFF8E1;border:2px solid #F59E0B;border-radius:6px;margin-bottom:16px">` +
    `<tr><td style="padding:12px;font-family:sans-serif;font-size:13px;color:#7c5800">` +
    `<strong>🧪 MODO PRUEBA</strong><br>` +
    `Este correo estaba dirigido originalmente a:<br>${originalRecipients}` +
    `</td></tr></table>`
  );
}

export function applyTestMode(email: OutgoingEmail, config: TestModeConfig): OutgoingEmail {
  if (!config.enabled) return email;
  if (!config.redirectTo) {
    throw new Error("TEST_MODE activo sin dirección de redirect configurada");
  }

  const original =
    config.label ?? [email.to, email.cc].filter(Boolean).join("<br>");
  const bannerHtml = banner(original);

  const bodyMatch = /<body[^>]*>/i.exec(email.html);
  const html = bodyMatch
    ? email.html.replace(bodyMatch[0], `${bodyMatch[0]}${bannerHtml}`)
    : `${bannerHtml}${email.html}`;

  return {
    to: config.redirectTo,
    cc: undefined,
    subject: email.subject, // intacto a propósito: permite verificar contenido
    html,
  };
}
