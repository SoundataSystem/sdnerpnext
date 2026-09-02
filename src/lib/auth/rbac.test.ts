// FASE 7 — RBAC granular: equivalencia legacy↔permiso en lo migrado,
// comportamiento (autorizado/no autorizado/wildcard/multi-rol).
import { describe, it, expect } from "vitest";
import {
  verificarPermiso,
  rolesConPermiso,
  rolTienePermiso,
  obtenerRoles,
} from "@/lib/auth/permisos";

describe("equivalencia requireRole → requirePermiso (módulos migrados)", () => {
  it("caja:cobrar === {admin, cajero, vendedor} (ROLES_CAJA legacy)", () => {
    expect([...rolesConPermiso("caja:cobrar")].sort()).toEqual(
      ["admin", "cajero", "vendedor"].sort(),
    );
  });

  it("caja:anular === {admin, cajero} (legacy anularCajaMovimiento)", () => {
    expect([...rolesConPermiso("caja:anular")].sort()).toEqual(
      ["admin", "cajero"].sort(),
    );
  });

  it("caja:facturar === {admin, cajero, contabilidad} (legacy facturar)", () => {
    expect([...rolesConPermiso("caja:facturar")].sort()).toEqual(
      ["admin", "cajero", "contabilidad"].sort(),
    );
  });

  it("cotizaciones:aprobar incluye admin,vendedor,administracion,supervisor_tecnico (alineada a legacy exacto)", () => {
    expect([...rolesConPermiso("cotizaciones:aprobar")].sort()).toEqual(
      ["admin", "vendedor", "administracion", "supervisor_tecnico"].sort(),
    );
  });

  it("devoluciones_venta:aprobar incluye admin,vendedor,cajero,administracion,devoluciones (alineada)", () => {
    expect([...rolesConPermiso("devoluciones_venta:aprobar")].sort()).toEqual(
      ["admin", "vendedor", "cajero", "administracion", "devoluciones"].sort(),
    );
  });
});

describe("comportamiento RBAC", () => {
  it("usuario autorizado → permitido", () => {
    expect(verificarPermiso("cajero", "caja", "cobrar")).toBe(true);
    expect(verificarPermiso("vendedor", "caja", "cobrar")).toBe(true);
  });

  it("usuario no autorizado → denegado", () => {
    expect(verificarPermiso("contabilidad", "caja", "cobrar")).toBe(false);
    expect(verificarPermiso("vendedor", "caja", "anular")).toBe(false);
    expect(verificarPermiso("vendedor", "usuarios", "editar")).toBe(false);
  });

  it("admin tiene wildcard (*)", () => {
    for (const recurso of ["caja", "ventas", "compras", "inventario"] as const) {
      for (const accion of ["leer", "crear", "editar", "anular"] as const) {
        expect(verificarPermiso("admin", recurso, accion)).toBe(true);
      }
    }
  });

  it("roles múltiples: cada rol evalúa por su propio set", () => {
    // cajero puede cobrar pero no crear devoluciones de compra;
    // compra puede devoluciones_compra pero no cobrar.
    expect(rolTienePermiso("cajero", "devoluciones_compra:crear")).toBe(false);
    expect(rolTienePermiso("compra", "devoluciones_compra:crear")).toBe(true);
    expect(rolTienePermiso("compra", "caja:cobrar")).toBe(false);
  });

  it("rol inexistente → todo denegado; todos los roles del catálogo existen", () => {
    expect(verificarPermiso("rol-fantasma", "caja", "leer")).toBe(false);
    expect(obtenerRoles().length).toBeGreaterThan(5);
  });
});
