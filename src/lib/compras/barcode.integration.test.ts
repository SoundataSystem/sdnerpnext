// FASE 7 — Punto 6: búsqueda por barcode determinista (sin UNIQUE en DB).
// buscarProductosPorBarcode devuelve TODAS las coincidencias con orden
// estable; la acción aplica la política 0→null / 1→único / N→conflicto.
import { describe, it, expect, beforeEach } from "vitest";
import { buscarProductosPorBarcode } from "@/lib/compras/repository";
import { limpiarEsquema } from "@/test/integration/db";
import { crearProducto } from "@/test/integration/fixtures";

beforeEach(async () => {
  await limpiarEsquema();
});

describe("buscarProductosPorBarcode", () => {
  it("sin coincidencias → []", async () => {
    const res = await buscarProductosPorBarcode("BC-INEXISTENTE");
    expect(res).toEqual([]);
  });

  it("un producto con ese barcode → exactamente 1 resultado", async () => {
    await crearProducto({ barcode: "BC-UNICO-1" });
    const res = await buscarProductosPorBarcode("BC-UNICO-1");
    expect(res).toHaveLength(1);
    expect(res[0].nombre).toBeTruthy();
  });

  it("barcode duplicado → TODAS las coincidencias, orden determinista por created_at", async () => {
    await crearProducto({ barcode: "BC-DUP", nombre: "Primero" });
    await crearProducto({ barcode: "BC-DUP", nombre: "Segundo" });
    // Insert fuera de orden para probar que el ORDER BY manda, no el id de inserción.
    await crearProducto({ barcode: "OTRO" });

    const res = await buscarProductosPorBarcode("BC-DUP");

    expect(res).toHaveLength(2);
    expect(res.map((r) => r.nombre)).toEqual(["Primero", "Segundo"]);
  });
});
