// Paridad EXACTA con app.has_permission (migración 0001, sección 8):
//   rp = '*'  OR  rp = p  OR  (rp like '%.*' AND p like replace(rp,'*','') || '%')
// Si esta semántica cambia, cambiar primero la función SQL y luego esto.
import { describe, expect, it } from "vitest";

import { hasPermission, permissionMatches } from "./permissions";

describe("permissionMatches (paridad con app.has_permission)", () => {
  it("'*' concede cualquier permiso", () => {
    expect(permissionMatches("*", "m06.invoice.void")).toBe(true);
    expect(permissionMatches("*", "core.tenant.manage")).toBe(true);
  });

  it("coincidencia exacta", () => {
    expect(permissionMatches("m06.invoice.void", "m06.invoice.void")).toBe(true);
    expect(permissionMatches("core.tenant.manage", "core.tenant.manage")).toBe(true);
  });

  it("comodín de módulo 'mXX.*' cubre todo el módulo", () => {
    expect(permissionMatches("m06.*", "m06.invoice.void")).toBe(true);
    expect(permissionMatches("m06.*", "m06.quote.create")).toBe(true);
    expect(permissionMatches("core.*", "core.tenant.manage")).toBe(true);
  });

  it("el comodín NO cruza módulos ni prefijos parciales", () => {
    expect(permissionMatches("m06.*", "m07.invoice.void")).toBe(false);
    expect(permissionMatches("m06.*", "m060.invoice.void")).toBe(false);
    expect(permissionMatches("m060.*", "m06.invoice.void")).toBe(false);
  });

  it("como en SQL, 'mXX.*' exige el punto: no cubre el key pelado del módulo", () => {
    // SQL: 'm06' NOT LIKE 'm06.%'
    expect(permissionMatches("m06.*", "m06")).toBe(false);
  });

  it("un permiso concreto no actúa como prefijo", () => {
    expect(permissionMatches("m06.invoice", "m06.invoice.void")).toBe(false);
    expect(permissionMatches("m06.invoice.void", "m06.invoice")).toBe(false);
  });
});

describe("hasPermission (sobre la lista de grants del rol)", () => {
  it("true si algún grant coincide", () => {
    expect(hasPermission(["m01.*", "m06.invoice.view"], "m06.invoice.view")).toBe(true);
    expect(hasPermission(["m01.*", "m06.invoice.view"], "m01.account.create")).toBe(true);
  });

  it("false sin coincidencias o con lista vacía", () => {
    expect(hasPermission(["m01.*"], "m06.invoice.view")).toBe(false);
    expect(hasPermission([], "m06.invoice.view")).toBe(false);
  });

  it("el rol owner ('*') concede todo", () => {
    expect(hasPermission(["*"], "m99.cualquier.cosa")).toBe(true);
  });
});
