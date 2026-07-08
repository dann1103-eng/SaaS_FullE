// Registros globales del proceso. Hoy se pueblan aquí; desde la Sesión 6 los
// manifests de módulos activos declaran sus handlers/suscripciones (DOC3 §3).
import { EventSubscriptions } from "./events/dispatcher";
import { JobHandlerRegistry } from "./jobs/runner";

export const jobRegistry = new JobHandlerRegistry();
export const eventSubscriptions = new EventSubscriptions();

// Handler de infraestructura para probar la tubería end-to-end (no negocio):
// encola core.noop → el tick lo completa devolviendo el payload.
jobRegistry.register("core.noop", async ({ job }) => {
  return { echo: job.payload };
});
