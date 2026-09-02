import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { ejecutarImportacion, revertirImportacion } from "@/lib/pegasus/importer";
import { procesarLote } from "@/lib/pegasus/importer";
import { limpiarEsquema, prisma } from "@/test/integration/db";
import { Prisma } from "@/generated/prisma/client";

beforeEach(async () => {
  await limpiarEsquema();
});

const DIR = process.env.PEGASUS_DIR ?? "C:/Users/Corporacion Capsula/Desktop/pegasus";
// Los fixtures XLSX son exportaciones reales de la máquina del ERP; si no
// existen en este entorno (o se apuntan vía PEGASUS_DIR), la suite se salta.
const FIXTURES_DISPONIBLES = existsSync(join(DIR, "proveedores.xlsx"));

function leerCSV(archivo: string): string {
  const ruta = join(DIR, archivo);
  const wb = XLSX.read(readFileSync(ruta), { type: "buffer" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  // Misma conversión que el cliente (pegasus-client.tsx:210).
  return XLSX.utils.sheet_to_csv(hoja, { FS: ";", blankrows: false });
}

describe.skipIf(!FIXTURES_DISPONIBLES)("Pegasus: importación real de los exports (schema test)", () => {
  it("valida que los 3 archivos se interpretan sin cambios y crean/actualizan en DB", async () => {
    const casos = [
      {
        archivo: "clientes.xlsx",
        tipo: "clientes" as const,
        totalFilas: 44659,
        // Muestra: el import completo (44k filas) contra la DB remota excede el
        // presupuesto del test de CI; se importan las primeras N líneas reales.
        toma: 2000,
      },
      { archivo: "proveedores.xlsx", tipo: "proveedores" as const, totalFilas: 374, toma: null },
      { archivo: "stock.xlsx", tipo: "productos" as const, totalFilas: 3858, toma: null },
    ];
    for (const c of casos) {
      const csv = leerCSV(c.archivo);
      const lineas = csv.split("\n");
      const contenido = c.toma ? [...lineas.slice(0, 1), ...lineas.slice(1, c.toma + 1)].join("\n") : csv;
      const res = await ejecutarImportacion(c.tipo, contenido);
      // El pipeline es interpretativo: la cabecera normalizada debe partir de las
      // columnas reales del archivo (sin edición manual del export).
      expect(
        res.log[0],
        `${c.archivo}: cabecera detectada`,
      ).toMatch(/^Cabecera detectada/);
      expect(res.filas_total, `${c.archivo}: total filas`).toBeGreaterThanOrEqual(
        (c.toma ?? c.totalFilas) - 20,
      );
      expect(res.filas_total, `${c.archivo}: total filas`).toBeLessThanOrEqual(
        c.toma ?? c.totalFilas,
      );
      // Casi todas las filas se mapean OK; se admiten márgenes mínimos de error
      // por filas sin nombre/código (datos del archivo fuente).
      expect(res.filas_ok, `${c.archivo}: filas OK`).toBeGreaterThan(res.filas_total * 0.9);
      expect(res.filas_error, `${c.archivo}: errores`).toBeLessThanOrEqual(20);
      // El bloque de resumen del pie del export (Totales/Categoría/Estado) no debe
      // generar filas de datos ni errores.
      expect(
        res.log.some((l) => l.includes("Total de Clientes") || l.includes("Líneas")),
        `${c.archivo}: sin filas de resumen en el log`,
      ).toBe(false);
    }
  }, 600000);

  it("proveedores: los datos se mapean desde las columnas reales (Nombre Proveedor)", async () => {
    const csv = leerCSV("proveedores.xlsx");
    const res = await ejecutarImportacion("proveedores", csv);
    const creados = res.creados.proveedores.length;
    expect(creados).toBeGreaterThan(360);
    const muestra = await prisma.proveedor.findMany({ take: 3 });
    expect(muestra.length).toBeGreaterThan(0);
    for (const p of muestra) {
      // La razón social proviene de la columna "Nombre Proveedor", que tras la
      // limpieza queda sin el paréntesis de la autorización.
      expect(p.supplier).toBeTruthy();
      expect(p.supplier!.match(/\(/)).toBeNull();
    }
  }, 600000);

  it("productos/stock: costo y precio se toman de Costo Unit. y Precio Unit.", async () => {
    const csv = leerCSV("stock.xlsx");
    const res = await ejecutarImportacion("productos", csv);
    expect(res.filas_ok).toBeGreaterThan(3800);
    const conCosto = await prisma.producto.count({ where: { purchase_cost: { gt: 0 } } });
    const conPrecio = await prisma.producto.count({ where: { precio_base: { gt: 0 } } });
    expect(conCosto).toBeGreaterThan(3500);
    expect(conPrecio).toBeGreaterThan(0);
  }, 600000);

  it("procesarLote (flujo chunked del cliente) acumula el resultado por lotes", async () => {
    const csv = leerCSV("proveedores.xlsx");
    const lineas = csv.split("\n");
    const cabecera = lineas[0];
    const cuerpo = lineas.slice(1).join("\n");
    const primera = await procesarLote("proveedores", cabecera, cuerpo, 0);
    // En 2º lote se reintenta lo mismo: los proveedores ya existen → actualiza.
    const segunda = await procesarLote("proveedores", cabecera, cuerpo, 0);
    expect(primera.filas_total).toBeGreaterThanOrEqual(370);
    expect(segunda.filas_warning).toBeGreaterThan(0);
  }, 600000);

  it("revertirImportacion restaura todo lo creado por la importación", async () => {
    const csv = leerCSV("proveedores.xlsx");
    const res = await ejecutarImportacion("proveedores", csv);
    const antes = await prisma.proveedor.count();
    expect(antes).toBeGreaterThan(0);
    const imp = await prisma.importacionPegasus.create({
      data: {
        tipo: "proveedores",
        archivo_nombre: "proveedores.xlsx",
        estado: "completada",
        filas_total: res.filas_total,
        filas_ok: res.filas_ok,
        filas_warning: res.filas_warning,
        filas_error: res.filas_error,
        usuario_id: null,
        log_detalle: {
          log: res.log,
          creados: res.creados,
          actualizados: res.actualizados,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    const rev = await revertirImportacion(imp.id);
    expect(rev.eliminados).toBeGreaterThan(0);
    const despues = await prisma.proveedor.count();
    expect(despues).toBe(0);
  }, 600000);
});