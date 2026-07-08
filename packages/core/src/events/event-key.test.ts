// Paridad EXACTA con el CHECK de domain_events.event_key (migración 0002):
//   ^(core|m[0-9]{2})\.[a-z0-9_]+\.[a-z0-9_]+$
// Convención DOC8: modulo.entidad.accion_pasado; catálogo cerrado (nuevo ⇒ ADR).
import { describe, expect, it } from "vitest";

import { assertValidEventKey, isValidEventKey } from "./event-key";

describe("isValidEventKey (paridad con CHECK de la migración 0002)", () => {
  it("acepta claves del catálogo DOC8", () => {
    expect(isValidEventKey("core.tenant.created")).toBe(true);
    expect(isValidEventKey("m07.payment.received")).toBe(true);
    expect(isValidEventKey("m08.account.suspended_nonpayment")).toBe(true);
    expect(isValidEventKey("m03.order.status_changed")).toBe(true);
  });

  it("rechaza módulos fuera de convención", () => {
    expect(isValidEventKey("m7.payment.received")).toBe(false); // mX sin cero
    expect(isValidEventKey("m123.payment.received")).toBe(false); // tres dígitos
    expect(isValidEventKey("billing.invoice.paid")).toBe(false); // prefijo libre
  });

  it("exige exactamente tres segmentos en minúsculas/underscore", () => {
    expect(isValidEventKey("m06.invoice")).toBe(false);
    expect(isValidEventKey("m06.invoice.paid.extra")).toBe(false);
    expect(isValidEventKey("m06.Invoice.paid")).toBe(false);
    expect(isValidEventKey("m06.invoice.paid ")).toBe(false);
  });

  it("assertValidEventKey lanza con la clave inválida en el mensaje", () => {
    expect(() => assertValidEventKey("cualquier.cosa")).toThrow(/cualquier\.cosa/);
    expect(() => assertValidEventKey("m01.account.created")).not.toThrow();
  });
});
