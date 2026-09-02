"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient, ConflictError } from "@/lib/safe-action";
import { requireRole, requireUser } from "@/lib/auth";
import {
  crearProveedorSchema,
  actualizarProveedorSchema,
  crearOcSchema,
  registrarRecepcionSchema,
  ingresarStockSchema,
  registrarPagoProveedorSchema,
  anularPagoProveedorSchema,
  cambioEstadoOcSchema,
} from "@/lib/compras/schema";
import {
  crearProveedor,
  actualizarProveedor,
  crearOrdenCompra,
  transicionEstadoOc,
  registrarRecepcion,
  ingresarStock,
  registrarPagoProveedor,
  anularPagoProveedor,
  getProximoOrdenCompraNumber,
  getOrdenCompra,
  getProveedor,
  getPagosProveedor,
  buscarProductosPorBarcode,
} from "@/lib/compras/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";
import { crearProducto } from "@/lib/inventario/repository";
import { crearProductoSchema } from "@/lib/inventario/schema";
import { prisma } from "@/lib/prisma";

const ROLES_COMPRAS = [
  "admin",
  "compra",
  "administracion",
  "recepcion_compras",
] as const;

function revalidarCompras() {
  revalidatePath("/compras", "layout");
}

// ─── Proveedores ────────────────────────────────────────────────────────────

export const crearProveedorAction = actionClient
  .inputSchema(crearProveedorSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    const usuario = await requireUser();
    const proveedor = await crearProveedor(parsedInput);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creado",
      entidad: "proveedor",
      entidad_id: proveedor.id,
      detalle: `Proveedor ${proveedor.supplier ?? proveedor.id} creado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { id: proveedor.id };
  });

export const actualizarProveedorAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de proveedor inválido"),
      data: actualizarProveedorSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    const usuario = await requireUser();
    await actualizarProveedor(parsedInput.id, parsedInput.data);
    const proveedor = await getProveedor(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "actualizado",
      entidad: "proveedor",
      entidad_id: parsedInput.id,
      detalle: `Proveedor ${proveedor?.supplier ?? parsedInput.id} actualizado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { ok: true };
  });

// ─── Órdenes de Compra ─────────────────────────────────────────────────────

export const crearOcAction = actionClient
  .inputSchema(crearOcSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    const usuario = await requireUser();
    const id = await crearOrdenCompra(parsedInput, usuario);
    const oc = await getOrdenCompra(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "orden_compra",
      entidad_id: id,
      detalle: `OC ${oc?.numero_orden ?? id} creada por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "compra", "administracion"],
        tipo: "oc_creada",
        titulo: `Nueva orden de compra ${oc?.numero_orden ?? ""}`,
        mensaje: `${usuario.nombre} ${usuario.apellido} creó una OC pendiente de aprobación`,
        entidad: "orden_compra",
        entidad_id: id,
      },
    });
    revalidarCompras();
    return { id };
  });

export const aprobarOcAction = actionClient
  .inputSchema(cambioEstadoOcSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requireRole("admin", "compra", "administracion");
    await transicionEstadoOc(parsedInput.id, "aprobar", {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    });
    const oc = await getOrdenCompra(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "aprobada",
      entidad: "orden_compra",
      entidad_id: parsedInput.id,
      detalle: `OC ${oc?.numero_orden ?? parsedInput.id} aprobada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { ok: true };
  });

export const enviarOcAction = actionClient
  .inputSchema(cambioEstadoOcSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requireRole("admin", "compra", "administracion");
    await transicionEstadoOc(parsedInput.id, "enviar", {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    });
    const oc = await getOrdenCompra(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "enviada",
      entidad: "orden_compra",
      entidad_id: parsedInput.id,
      detalle: `OC ${oc?.numero_orden ?? parsedInput.id} enviada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { ok: true };
  });

export const cancelarOcAction = actionClient
  .inputSchema(cambioEstadoOcSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requireRole("admin", "compra", "administracion");
    await transicionEstadoOc(parsedInput.id, "cancelar", {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    });
    const oc = await getOrdenCompra(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cancelada",
      entidad: "orden_compra",
      entidad_id: parsedInput.id,
      detalle: `OC ${oc?.numero_orden ?? parsedInput.id} cancelada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { ok: true };
  });

export const cerrarOcAction = actionClient
  .inputSchema(cambioEstadoOcSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requireRole("admin", "compra", "administracion");
    await transicionEstadoOc(parsedInput.id, "cerrar", {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    });
    const oc = await getOrdenCompra(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cerrada",
      entidad: "orden_compra",
      entidad_id: parsedInput.id,
      detalle: `OC ${oc?.numero_orden ?? parsedInput.id} cerrada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { ok: true };
  });

export const siguienteNumeroOcAction = actionClient.action(async () => {
  await requireRole(...ROLES_COMPRAS);
  return { numero: await getProximoOrdenCompraNumber() };
});

// ─── Recepción / Ingreso a stock ───────────────────────────────────────────

export const registrarRecepcionAction = actionClient
  .inputSchema(registrarRecepcionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    const usuario = await requireUser();
    const res = await registrarRecepcion(parsedInput, usuario);
    const oc = await getOrdenCompra(res.oc_id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "registrada",
      entidad: "recepcion_compra",
      entidad_id: res.id,
      detalle: `Recepción ${res.id} de la OC ${oc?.numero_orden ?? ""} registrada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return res;
  });

export const ingresarStockAction = actionClient
  .inputSchema(ingresarStockSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    const usuario = await requireUser();
    const res = await ingresarStock(parsedInput, usuario);
    const oc = await getOrdenCompra(res.oc_id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "ingresada",
      entidad: "ingreso_stock_compra",
      entidad_id: res.id,
      detalle: `Stock de la OC ${oc?.numero_orden ?? ""} ingresado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return res;
  });

// ─── Recepción: barcode / código sugerido / factura ────────────────────────

export const buscarProductoPorBarcodeAction = actionClient
  .inputSchema(z.object({ barcode: z.string().trim().min(1).max(100) }))
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    // Comportamiento determinista (AUDITORIA_FASE7.md §6.6, sin UNIQUE en DB):
    // 0 coincidencias → null; 1 → producto único;
    // N → ConflictError (el operador elige manualmente, nunca un arbitrario).
    const matches = await buscarProductosPorBarcode(parsedInput.barcode);
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      const codigos = matches
        .map((m) => m.codigo || m.nombre)
        .slice(0, 5)
        .join(", ");
      throw new ConflictError(
        `El barcode está compartido por ${matches.length} productos (${codigos}). Seleccione el producto manualmente.`,
      );
    }
    return matches[0];
  });

export const sugerirCodigoProductoAction = actionClient.action(async () => {
  await requireRole(...ROLES_COMPRAS);
  const ultimo = await prisma.producto.findFirst({
    where: { codigo: { not: null } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  const base = ultimo?.codigo ?? "";
  let candidato = base
    ? String((parseInt(base.replace(/\D/g, ""), 10) || 0) + 1).padStart(
        base.length || 5,
        "0",
      )
    : "10000";
  for (let i = 0; i < 50; i++) {
    const existe = await prisma.producto.findFirst({
      where: { codigo: candidato },
      select: { id: true },
    });
    if (!existe) return { codigo: candidato };
    const n = parseInt(candidato.replace(/\D/g, ""), 10) || 0;
    candidato = String(n + 1).padStart(candidato.length, "0");
  }
  return { codigo: "" };
});

export const adjuntarFacturaRecepcionAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de recepción inválido"),
      url: z.string().url("URL inválida").max(2000),
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    await prisma.recepcionCompra.update({
      where: { id: parsedInput.id },
      data: { factura_archivo_url: parsedInput.url },
    });
    revalidarCompras();
    return { ok: true };
  });

// ─── Creación rápida de producto ───────────────────────────────────────────

export const crearProductoCompraAction = actionClient
  .inputSchema(crearProductoSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requireRole(...ROLES_COMPRAS);
    let id: string;
    try {
      id = await crearProducto(parsedInput);
    } catch (e) {
      if (
        (e as { code?: string }).code === "P2002" ||
        (e instanceof Error && e.message.startsWith("Ya existe un producto"))
      ) {
        throw new ConflictError("Ya existe un producto con ese código o barcode");
      }
      throw e;
    }
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creado",
      entidad: "producto",
      entidad_id: id,
      detalle: `Producto ${parsedInput.nombre} creado desde Compras por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidatePath("/inventario", "layout");
    revalidarCompras();
    return { id };
  });

// ─── Pagos a proveedores ───────────────────────────────────────────────────

export const registrarPagoProveedorAction = actionClient
  .inputSchema(registrarPagoProveedorSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COMPRAS);
    const usuario = await requireUser();
    const id = await registrarPagoProveedor(parsedInput, usuario);
    const pago = (await getPagosProveedor()).find((p) => p.id === id);
    const oc = await getOrdenCompra(parsedInput.oc_id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "registrado",
      entidad: "pago_proveedor",
      entidad_id: id,
      detalle: `Pago ${pago?.monto ?? ""} a proveedor en OC ${oc?.numero_orden ?? ""} por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCompras();
    return { id };
  });

export const anularPagoProveedorAction = actionClient
  .inputSchema(anularPagoProveedorSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requireRole("admin", "compra", "administracion");
    await anularPagoProveedor(parsedInput.id, parsedInput.motivo);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "anulado",
      entidad: "pago_proveedor",
      entidad_id: parsedInput.id,
      detalle: `Pago ${parsedInput.id} anulado por ${usuario.nombre} ${usuario.apellido}: ${parsedInput.motivo}`,
    });
    revalidarCompras();
    return { ok: true };
  });