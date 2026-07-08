export { hasPermission, permissionMatches } from "./auth/permissions";
export {
  AuthenticationError,
  PermissionDeniedError,
  decodeAccessTokenClaims,
  getAuthContext,
  type AuthContext,
} from "./auth/session";
export {
  fetchGrants,
  requirePermission,
  type PermissionContext,
} from "./auth/require-permission";

export type { DbClient, DomainEventRow, JobRow } from "./db-client";

export { assertValidEventKey, isValidEventKey } from "./events/event-key";
export { emitDomainEvent, type DomainEventInput } from "./events/emit";
export {
  EventSubscriptions,
  dispatchDomainEventsTick,
  type DispatchResult,
  type DomainEventHandler,
} from "./events/dispatcher";

export { retryDelaySeconds } from "./jobs/backoff";
export { enqueueJob, type EnqueueJobInput, type EnqueueResult } from "./jobs/enqueue";
export {
  JobHandlerRegistry,
  runJobsTick,
  type JobHandler,
  type JobsTickResult,
} from "./jobs/runner";

export { eventSubscriptions, jobRegistry } from "./registries";
