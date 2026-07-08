// Backoff exponencial de reintentos (DOC3 §3): min(60s, 2^attempts).
export function retryDelaySeconds(attempts: number): number {
  const safe = Math.max(0, Math.trunc(attempts));
  return Math.min(60, 2 ** safe);
}
