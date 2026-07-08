// DOC3 §3: reintentos con backoff exponencial min(60s, 2^attempts).
import { describe, expect, it } from "vitest";

import { retryDelaySeconds } from "./backoff";

describe("retryDelaySeconds (DOC3 §3)", () => {
  it("crece exponencialmente con los intentos", () => {
    expect(retryDelaySeconds(1)).toBe(2);
    expect(retryDelaySeconds(2)).toBe(4);
    expect(retryDelaySeconds(3)).toBe(8);
    expect(retryDelaySeconds(5)).toBe(32);
  });

  it("se satura en 60 segundos", () => {
    expect(retryDelaySeconds(6)).toBe(60); // 2^6 = 64 → cap
    expect(retryDelaySeconds(10)).toBe(60);
    expect(retryDelaySeconds(100)).toBe(60);
  });

  it("tolera entradas degeneradas sin explotar", () => {
    expect(retryDelaySeconds(0)).toBe(1); // 2^0
    expect(retryDelaySeconds(-3)).toBe(1); // se trata como 0
  });
});
