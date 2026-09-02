import { describe, it, expect } from "vitest";
import {
  siguienteEstadoRma,
  esEstadoRmaFinal,
  type AccionRma,
} from "./maquina-estados";

const FLUJO: Array<{ accion: AccionRma; desde: string; hacia: string }> = [
  { accion: "recibir", desde: "pendiente", hacia: "recibido" },
  { accion: "iniciar_diagnostico", desde: "recibido", hacia: "en_diagnostico" },
  { accion: "diagnosticar", desde: "en_diagnostico", hacia: "diagnosticado" },
  { accion: "resolver", desde: "diagnosticado", hacia: "resuelto" },
  { accion: "cerrar", desde: "resuelto", hacia: "cerrado" },
];

describe("siguienteEstadoRma", () => {
  it("F8: recorre el flujo completo pendiente → cerrado pasando por en_diagnostico", () => {
    for (const t of FLUJO) {
      expect(siguienteEstadoRma(t.desde, t.accion)).toBe(t.hacia);
    }
  });

  it("F8: rechazar/cancelar permitidos desde cualquier estado abierto", () => {
    for (const abierto of ["pendiente", "recibido", "en_diagnostico", "diagnosticado", "resuelto"]) {
      expect(siguienteEstadoRma(abierto, "rechazar")).toBe("rechazado");
      expect(siguienteEstadoRma(abierto, "cancelar")).toBe("cancelado");
    }
  });

  it("F8: rechaza saltos ilegales (recibir desde en_diagnostico, etc.)", () => {
    expect(() => siguienteEstadoRma("en_diagnostico", "recibir")).toThrow();
    expect(() => siguienteEstadoRma("pendiente", "diagnosticar")).toThrow();
    expect(() => siguienteEstadoRma("diagnosticado", "cerrar")).toThrow();
    expect(() => siguienteEstadoRma("recibido", "resolver")).toThrow();
    expect(() => siguienteEstadoRma("cerrado", "rechazar")).toThrow();
  });

  it("F8: los estados finales no avanzan", () => {
    expect(() => siguienteEstadoRma("cerrado", "recibir")).toThrow();
    expect(() => siguienteEstadoRma("cancelado", "diagnosticar")).toThrow();
    expect(() => siguienteEstadoRma("rechazado", "resolver")).toThrow();
  });
});

describe("esEstadoRmaFinal", () => {
  it("F8: cerrado/cancelado/rechazado son finales; el resto no", () => {
    expect(esEstadoRmaFinal("cerrado")).toBe(true);
    expect(esEstadoRmaFinal("cancelado")).toBe(true);
    expect(esEstadoRmaFinal("rechazado")).toBe(true);
    expect(esEstadoRmaFinal("pendiente")).toBe(false);
    expect(esEstadoRmaFinal("resuelto")).toBe(false);
  });
});
