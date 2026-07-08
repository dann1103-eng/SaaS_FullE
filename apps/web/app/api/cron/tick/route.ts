// Endpoint único de crons (DOC3 §3): Vercel cron (GET) o invocación manual
// (POST) con Bearer CRON_SECRET. Despacha la cola de jobs y el outbox de
// eventos para todos los tenants. Todo lo asíncrono es re-ejecutable e
// idempotente (red de seguridad estilo ADEC).
import {
  dispatchDomainEventsTick,
  eventSubscriptions,
  jobRegistry,
  processDeliveriesTick,
  runJobsTick,
  selectEmailTransport,
} from "@plataforma/core";
import { createSupabaseAdminClient } from "@plataforma/db";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as z from "zod";

const SecretSchema = z
  .string()
  .min(16, { error: "CRON_SECRET debe tener al menos 16 caracteres" });

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // Comparación en tiempo constante (línea base de seguridad, DOC3 §12).
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleTick(request: Request): Promise<NextResponse> {
  const secret = SecretSchema.safeParse(process.env.CRON_SECRET);
  if (!secret.success) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (!authorized(request, secret.data)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  // Orden deliberado: jobs (pueden emitir eventos) → eventos (los productores
  // crean notificaciones/entregas) → entregas (se envían en el MISMO tick).
  const jobs = await runJobsTick(admin, jobRegistry);
  const events = await dispatchDomainEventsTick(admin, eventSubscriptions);
  const deliveries = await processDeliveriesTick(admin, {
    transport: selectEmailTransport({ RESEND_API_KEY: process.env.RESEND_API_KEY }),
    fromAddress: process.env.EMAIL_FROM ?? "Plataforma <onboarding@resend.dev>",
    globalTestMode: (process.env.EMAIL_TEST_MODE ?? "false").toLowerCase() === "true",
    testRedirectTo: process.env.EMAIL_TEST_REDIRECT ?? "",
  });

  return NextResponse.json({ ok: true, jobs, events, deliveries });
}

export async function GET(request: Request) {
  return handleTick(request);
}

export async function POST(request: Request) {
  return handleTick(request);
}
