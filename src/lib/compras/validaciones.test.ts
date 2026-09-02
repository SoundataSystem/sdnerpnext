import { describe, it, expect } from "vitest";
import {
  errorEstadoRecepcion,
  errorSobreRecepcion,
  errorPagoSuperaSaldo,
  todosLosItemsCompletos,
} from "./validaciones";

describe("todosLosItemsCompletos", () => {
  it("Caso A: una sola recepción completa toda la OC", () => {
    const ocItems = [
      { id: "a", cantidad: 10, cantidad_recibida: 0 },
      { id: "b", cantidad: 5, cantidad_recibida: 0 },
    ];
    const totales = new Map([
      ["a", 10],
      ["b", 5],
    ]);
    expect(todosLosItemsCompletos(ocItems, totales)).toBe(true);
  });

  it("Caso B: recepción parcial deja la OC incompleta", () => {
    const ocItems = [
      { id: "a", cantidad: 10, cantidad_recibida: 0 },
      { id: "b", cantidad: 5, cantidad_recibida: 0 },
    ];
    const totales = new Map([["a", 10]]);
    expect(todosLosItemsCompletos(ocItems, totales)).toBe(false);
  });

  it("Caso B (fix): la UI envía solo los ítems recibidos; se respeta el avance previo", () => {
    const ocItems = [
      { id: "a", cantidad: 10, cantidad_recibida: 5 },
      { id: "b", cantidad: 5, cantidad_recibida: 5 },
    ];
    const totales = new Map([["a", 10]]);
    expect(todosLosItemsCompletos(ocItems, totales)).toBe(true);
  });

  it("Caso B: ítem nunca recibido mantiene la OC incompleta", () => {
    const ocItems = [
      { id: "a", cantidad: 10, cantidad_recibida: 0 },
      { id: "b", cantidad: 5, cantidad_recibida: 0 },
    ];
    expect(todosLosItemsCompletos(ocItems, new Map())).toBe(false);
  });
});

describe("errorSobreRecepcion", () => {
  it("Caso C: sobre-recepción (5 recibido + 6 nuevo > 10) lanza error", () => {
    expect(
      errorSobreRecepcion({ yaRecibido: 5, nuevo: 6, solicitado: 10 }),
    ).toContain("supera");
  });

  it("Caso C: recibir exactamente lo solicitado es válido", () => {
    expect(errorSobreRecepcion({ yaRecibido: 5, nuevo: 5, solicitado: 10 })).toBeNull();
  });

  it("Caso C: recibir menos de lo solicitado es válido", () => {
    expect(errorSobreRecepcion({ yaRecibido: 0, nuevo: 3, solicitado: 10 })).toBeNull();
  });

  it("Caso C: cantidad negativa lanza error", () => {
    expect(
      errorSobreRecepcion({ yaRecibido: 0, nuevo: -1, solicitado: 10 }),
    ).toContain("negativa");
  });
});

describe("errorEstadoRecepcion", () => {
  it("Caso D: admite OC en enviada y recepcion_parcial", () => {
    expect(errorEstadoRecepcion("enviada")).toBeNull();
    expect(errorEstadoRecepcion("recepcion_parcial")).toBeNull();
  });

  it("Caso D: rechaza OC en borrador o aprobada", () => {
    expect(errorEstadoRecepcion("borrador")).toContain("no admite recepciones");
    expect(errorEstadoRecepcion("aprobada")).toContain("no admite recepciones");
  });

  it("Caso D: rechaza OC ingresada, cancelada, cerrada o pendiente_ingreso_stock", () => {
    for (const estado of [
      "ingresada",
      "cancelada",
      "cerrada",
      "pendiente_ingreso_stock",
    ]) {
      expect(errorEstadoRecepcion(estado)).toContain("no admite recepciones");
    }
  });
});

describe("errorPagoSuperaSaldo", () => {
  it("Caso F: monto mayor al saldo lanza error", () => {
    expect(errorPagoSuperaSaldo({ monto: 1001, saldo: 1000 })).toContain("supera");
  });

  it("Caso F: monto menor o igual al saldo es válido", () => {
    expect(errorPagoSuperaSaldo({ monto: 500, saldo: 1000 })).toBeNull();
    expect(errorPagoSuperaSaldo({ monto: 1000, saldo: 1000 })).toBeNull();
  });
});
