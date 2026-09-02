import { describe, it, expect } from "vitest";
import { rolesPermiten, rolesExisten, ROLES, ROLES_VALIDOS } from "./roles";

describe("rolesPermiten", () => {
  it("permite cuando el rol está en la lista", () => {
    expect(rolesPermiten("admin", ["admin", "vendedor"])).toBe(true);
    expect(rolesPermiten("vendedor", ["admin", "vendedor", "cajero"])).toBe(true);
  });

  it("deniega cuando el rol no está en la lista", () => {
    expect(rolesPermiten("cajero", ["admin", "vendedor"])).toBe(false);
    expect(rolesPermiten("chofer", ["admin"])).toBe(false);
  });

  it("deniega lista vacía", () => {
    expect(rolesPermiten("admin", [])).toBe(false);
  });

  it("es coherente con requireRole: admin siempre permitido en todas las matrices", () => {
    const matrices = [
      ["admin", "vendedor", "cajero"],
      ["admin", "cajero", "contabilidad"],
      ["admin", "compra", "administracion", "recepcion_compras"],
      ["admin", "deposito", "administracion", "logistica"],
      ["admin", "administracion", "logistica"],
      ["admin", "vendedor", "servicio_tecnico", "supervisor_tecnico"],
      ["admin", "contabilidad"],
      ["admin", "vendedor"],
      ["admin"],
    ];
    for (const m of matrices) {
      expect(rolesPermiten("admin", m), `admin en ${m}`).toBe(true);
    }
  });
});

describe("rolesExisten", () => {
  it("retorna lista vacía si todos los roles son válidos", () => {
    expect(rolesExisten(["admin", "vendedor", "cajero"])).toEqual([]);
    expect(rolesExisten(ROLES.map((r) => r.value))).toEqual([]);
  });

  it("detecta roles que no existen en el catálogo", () => {
    expect(rolesExisten(["admin", "tecnico"])).toEqual(["tecnico"]);
    expect(rolesExisten(["recepcion_compras"])).toEqual([]);
  });
});

describe("ROLES_VALIDOS", () => {
  it("cubre exactamente el catálogo ROLES", () => {
    expect(ROLES_VALIDOS.size).toBe(ROLES.length);
    for (const r of ROLES) expect(ROLES_VALIDOS.has(r.value)).toBe(true);
  });
});
