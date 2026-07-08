// Registros globales del proceso. Hoy se pueblan aquí; desde la Sesión 6 los
// manifests de módulos activos declaran sus handlers/suscripciones (DOC3 §3).
import { EventSubscriptions } from "./events/dispatcher";
import { JobHandlerRegistry } from "./jobs/runner";
import { jobFailedFinalProducer } from "./notifications/producers";

export const jobRegistry = new JobHandlerRegistry();
export const eventSubscriptions = new EventSubscriptions();

// Handler de infraestructura para probar la tubería end-to-end (no negocio):
// encola core.noop → el tick lo completa devolviendo el payload.
jobRegistry.register("core.noop", async ({ job }) => {
  return { echo: job.payload };
});

// C5 (Sesión 4): primer consumidor real del bus — job fallido definitivo →
// feed + email a los admins del tenant (DOC8: core.job.failed_final → C5).
eventSubscriptions.on("core.job.failed_final", jobFailedFinalProducer);
