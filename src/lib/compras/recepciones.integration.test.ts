// FASE 7 — Recepciones de compra: sobre-recepción concurrente y acumulado.
// Desde 2026-08-25 se permite excedente (usuario pidió poder agregar igual, mínimo 1).
// El lock sigue serializando, pero total > solicitado ya no rechaza: se registra con warning.
import { describe, it, expect, beforeEach } from "vitest";
import {
  crearOrdenCompra,
  transicionEstadoOc,
  registrarRecepcion,
  ingresarStock,
} from "@/lib/compras/repository";
import { limpiarEsquema, prisma } from "@/test/integration/db";
import {
  crearVendedor,
  crearProducto,
  crearDeposito,
  setStock,
  crearConfiguracion,
} from "@/test/integration/fixtures";

beforeEach(async () => {
  await limpiarEsquema();
});

async function setupOcEnviada(cantidad: number) {
  const admin = await crearVendedor({
    rol: "admin",
    vendedor_codigo: "A-REC",
    email: "admin-recepciones@test.local",
  });
  await crearConfiguracion();
  const producto = await crearProducto({ purchase_cost: 10000, activo: true });
  const proveedor = await prisma.proveedor.create({
    data: {
      supplier: "Prov Recepciones",
      tax: `RUC-${Date.now()}`,
      phone: "1",
      address: "T",
      document_type: "RUC",
      term: "NET",
      condition_description: "",
      tiene_acuerdo_comercial: false,
    },
  });
  const ocId = await crearOrdenCompra(
    {
      proveedor_id: proveedor.id,
      items: [{ producto_id: producto.id, cantidad, unit_price: 10000 }],
      is_tax_included: false,
      remarks: "TEST RECEPCIONES",
      warehouse: "",
    },
    admin,
  );
  await transicionEstadoOc(ocId, "aprobar");
  await transicionEstadoOc(ocId, "enviar");
  const item = await prisma.ordenesCompraItem.findFirst({
    where: { ordenCompra: { id: ocId } },
  });
  return { admin, producto, ocId, ocItemId: item!.item_id };
}

function recepcionInput(ocId: string, ocItemId: string, cantidad: number) {
  return {
    oc_id: ocId,
    items: [{ oc_item_id: ocItemId, cantidad_recibida: cantidad }],
  };
}

async function estadoOc(ocId: string) {
  const oc = await prisma.ordenesCompra.findUnique({ where: { id: ocId } });
  const item = await prisma.ordenesCompraItem.findFirst({
    where: { ordenCompra: { id: ocId } },
  });
  return { estado: oc!.estado, recibido: Number(item!.cantidad_recibida ?? 0) };
}

describe("recepciones concurrentes sobre la misma OC", () => {
  it("dos recepciones de 3 sobre cantidad 5: ambas ok con excedente (+1), total 6", async () => {
    const { admin, ocId, ocItemId } = await setupOcEnviada(5);

    const resultados = await Promise.allSettled([
      registrarRecepcion(recepcionInput(ocId, ocItemId, 3), admin),
      registrarRecepcion(recepcionInput(ocId, ocItemId, 3), admin),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(2);

    const { estado, recibido } = await estadoOc(ocId);
    expect(recibido).toBe(6); // excedente permitido: 3+3=6 (>5) se registra igual
    expect(estado).toBe("pendiente_ingreso_stock");
  });

  it("parciales complementarios (2 + 3 sobre 5) en paralelo: ambas ok y OC completa", async () => {
    const { admin, ocId, ocItemId } = await setupOcEnviada(5);

    const resultados = await Promise.allSettled([
      registrarRecepcion(recepcionInput(ocId, ocItemId, 2), admin),
      registrarRecepcion(recepcionInput(ocId, ocItemId, 3), admin),
    ]);

    // 2 + 3 = 5 exactos: ninguna excede; el lock serializa la acumulación.
    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);

    const { estado, recibido } = await estadoOc(ocId);
    expect(recibido).toBe(5);
    expect(estado).toBe("pendiente_ingreso_stock");
  });

  it("secuencial excedente: 4 ok, luego 2 sobre 5 → permitido con excedente, total 6", async () => {
    const { admin, ocId, ocItemId } = await setupOcEnviada(5);

    await registrarRecepcion(recepcionInput(ocId, ocItemId, 4), admin);
    await registrarRecepcion(recepcionInput(ocId, ocItemId, 2), admin);

    const { recibido } = await estadoOc(ocId);
    expect(recibido).toBe(6);
  });
});

describe("ingreso a stock", () => {
  it("doble ingreso concurrente: 1 éxito, stock acreditado UNA sola vez", async () => {
    const { admin, producto, ocId, ocItemId } = await setupOcEnviada(5);
    const deposito = await crearDeposito();

    await registrarRecepcion(recepcionInput(ocId, ocItemId, 5), admin);

    const resultados = await Promise.allSettled([
      ingresarStock({ oc_id: ocId, deposito_id: deposito.id }, admin),
      ingresarStock({ oc_id: ocId, deposito_id: deposito.id }, admin),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(1);

    const pd = await prisma.productoDeposito.findUnique({
      where: { producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id } },
    });
    expect(Number(pd?.stock ?? 0)).toBe(5);
  });
});
