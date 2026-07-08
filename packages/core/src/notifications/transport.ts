// Transporte de email tras interfaz (DOC3 §4, patrón factory de TAS: se
// ELIGE un transporte por configuración disponible — no cascada en runtime).
// v1: Resend vía fetch (sin SDK). SMTP/Gmail se añaden con la misma interfaz
// cuando algún tenant lo requiera.
import type { OutgoingEmail } from "./test-mode";

export interface SendResult {
  providerId: string | null;
}

export interface EmailTransport {
  readonly name: string;
  send(from: string, email: OutgoingEmail): Promise<SendResult>;
}

export function createResendTransport(apiKey: string): EmailTransport {
  return {
    name: "resend",
    async send(from, email) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email.to],
          ...(email.cc ? { cc: [email.cc] } : {}),
          subject: email.subject,
          html: email.html,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(`resend ${response.status}: ${body.message ?? "error desconocido"}`);
      }
      return { providerId: body.id ?? null };
    },
  };
}

/**
 * Selección por prioridad de configuración (TAS): hoy solo Resend; devolver
 * null = ningún transporte configurado (el tick deja los deliveries pendientes
 * y lo reporta, en vez de fallar el proceso completo).
 */
export function selectEmailTransport(env: { RESEND_API_KEY?: string }): EmailTransport | null {
  if (env.RESEND_API_KEY) return createResendTransport(env.RESEND_API_KEY);
  return null;
}
