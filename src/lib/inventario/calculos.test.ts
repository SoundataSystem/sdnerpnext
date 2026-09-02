import { describe, expect, it } from "vitest";
import {
  diferenciaStock,
  direccionMovimiento,
  esBajoStock,
  formatCantidad,
  numeroAjusteSecuencia,
} from "./calculos";

describe("inventario/calculos", () => {
  describe("diferenciaStock", () => {
    it("calcula la diferencia entre stock nuevo y actual", () => {
      expect(diferenciaStock(10, 5)).toBe(5);
      expect(diferenciaStock(3, 8)).toBe(-5);
      expect(diferenciaStock(7, 7)).toBe(0);
    });
  });

  describe("direccionMovimiento", () => {
    it("clasifica entrada/salida por el signo de la diferencia", () => {
      expect(direccionMovimiento(4)).toBe("entrada");
      expect(direccionMovimiento(0)).toBe("entrada");
      expect(direccionMovimiento(-2)).toBe("salida");
    });
  });

  describe("esBajoStock", () => {
    it("detecta stock por debajo del mínimo", () => {
      expect(esBajoStock(2, 3)).toBe(true);
      expect(esBajoStock(3, 3)).toBe(false);
      expect(esBajoStock(10, 3)).toBe(false);
      expect(esBajoStock(0, 0)).toBe(false);
    });
  });

  describe("formatCantidad", () => {
    it("formatea enteros y decimales", () => {
      expect(formatCantidad(1200)).toBe("1.200");
      expect(formatCantidad(12.5)).toBe("12,5");
    });
  });

  describe("numeroAjusteSecuencia", () => {
    it("genera AJ-YYYY-XXXX con padding", () => {
      expect(numeroAjusteSecuencia(2026, 7)).toBe("AJ-2026-0007");
      expect(numeroAjusteSecuencia(2025, 123)).toBe("AJ-2025-0123");
    });
  });
});