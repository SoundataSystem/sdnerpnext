import { describe, expect, it } from "vitest";
import {
  claveNumerador,
  formatearNumero,
  getNextNumero,
  getProximoNumero,
} from "./numeracion";

describe("claveNumerador", () => {
  it("compone tipo y año", () => {
    expect(claveNumerador("orden", 2026)).toBe("orden:2026");
    expect(claveNumerador("asiento", 2027)).toBe("asiento:2027");
  });
});

describe("formatearNumero", () => {
  it("formatea PREFIJO-AAAA-SEQ con 4 dígitos", () => {
    expect(formatearNumero("VTA", 2026, 1)).toBe("VTA-2026-0001");
    expect(formatearNumero("OC", 2026, 42)).toBe("OC-2026-0042");
    expect(formatearNumero("AS", 2025, 9999)).toBe("AS-2025-9999");
  });

  it("nunca devuelve secuencia 0", () => {
    expect(formatearNumero("G", 2026, 0)).toBe("G-2026-0001");
  });

  it("no trunca secuencias > 9999", () => {
    expect(formatearNumero("DV", 2026, 12345)).toBe("DV-2026-12345");
  });
});

describe("getNextNumero/getProximoNumero (SQL atómico)", () => {
  const estado = new Map<string, number>();
  const caller = {
    $queryRaw: async <T>(q: TemplateStringsArray, ...v: unknown[]): Promise<T> => {
      const sql = q.join("?");
      const tipo = String(v[0]);
      if (sql.includes("RETURNING ultimo AS seq")) {
        const sig = (estado.get(tipo) ?? 0) + 1;
        estado.set(tipo, sig);
        return [{ seq: sig }] as unknown as T;
      }
      // SELECT ... MAX(ultimo) ...
      const sig = (estado.get(tipo) ?? 0) + 1;
      return [{ seq: sig }] as unknown as T;
    },
  };

  it("incrementa de forma monótona (dos llamadas → números distintos)", async () => {
    const a = await getNextNumero(caller, "orden", 2026);
    const b = await getNextNumero(caller, "orden", 2026);
    expect(b).toBe(a + 1);
  });

  it("el primer uso de un tipo/año devuelve 1 (no 0)", async () => {
    const n = await getNextNumero(caller, "devolucion_venta", 2026);
    expect(n).toBe(1);
    expect(formatearNumero("DV", 2026, n)).toBe("DV-2026-0001");
  });

  it("separa secuencias por tipo y año", async () => {
    const n1 = await getNextNumero(caller, "asiento", 2026);
    const n2 = await getNextNumero(caller, "asiento", 2027);
    expect(n2).toBe(1);
    expect(n1).toBeGreaterThanOrEqual(1);
  });

  it("getProximoNumero estima sin consumir", async () => {
    estado.clear();
    await getNextNumero(caller, "rma", 2026);
    const p = await getProximoNumero(caller, "rma", 2026);
    expect(p).toBe(2);
    // tras estimar, el siguiente real sigue siendo 2 (no consumió)
    const real = await getNextNumero(caller, "rma", 2026);
    expect(real).toBe(2);
  });
});
