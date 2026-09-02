"use server";

import { revalidatePath } from "next/cache";
import { actionClient } from "@/lib/safe-action";
import { requireRole, requireUser } from "@/lib/auth";
import {
  crearDevolucionVentaSchema,
  crearDevolucionCompraSchema,
  procesarDevolucionSchema,
} from "@/lib/devoluciones/schema";
import {
  crearDevolucionVenta,
  crearDevolucionCompra,
  aprobarDevolucionVenta,
  rechazarDevolucionVenta,
  aprobarDevolucionCompra,
  rechazarDevolucionCompra,
  getDevolucionVenta,
  getDevolucionCompra,
} from "@/lib/devoluciones/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

const ROLES_DEVOLUCIONES = ["admin", "vendedor", "cajero"] as const;

function revalidarDevoluciones() {
  revalidatePath("/devoluciones", "layout");
}

// ─── Ventas ────────────────────────────────────────────────────────────────

export const crearDevolucionVentaAction = actionClient
  .inputSchema(crearDevolucionVentaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_DEVOLUCIONES);
    const usuario = await requireUser();
    const id = await crearDevolucionVenta(parsedInput, usuario);
    const dev = await getDevolucionVenta(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "devolucion_venta",
      entidad_id: id,
      detalle: `Devolución ${dev?.numero_devolucion ?? id} registrada por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "vendedor"],
        tipo: "devolucion_venta_creada",
        titulo: `Devolución de venta ${dev?.numero_devolucion ?? ""} registrada`,
        mensaje: `Hay una devolución pendiente de aprobación`,
        entidad: "devolucion_venta",
        entidad_id: id,
      },
    });
    revalidarDevoluciones();
    return { id };
  });

export const aprobarDevolucionVentaAction = actionClient
  .inputSchema(procesarDevolucionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await aprobarDevolucionVenta(parsedInput.id, usuario);
    const dev = await getDevolucionVenta(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "aprobada",
      entidad: "devolucion_venta",
      entidad_id: parsedInput.id,
      detalle: `Devolución ${dev?.numero_devolucion ?? parsedInput.id} aprobada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarDevoluciones();
    return { ok: true };
  });

export const rechazarDevolucionVentaAction = actionClient
  .inputSchema(procesarDevolucionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await rechazarDevolucionVenta(parsedInput.id);
    const dev = await getDevolucionVenta(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "rechazada",
      entidad: "devolucion_venta",
      entidad_id: parsedInput.id,
      detalle: `Devolución ${dev?.numero_devolucion ?? parsedInput.id} rechazada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarDevoluciones();
    return { ok: true };
  });

// ─── Compras ───────────────────────────────────────────────────────────────

export const crearDevolucionCompraAction = actionClient
  .inputSchema(crearDevolucionCompraSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "compra", "administracion");
    const usuario = await requireUser();
    const id = await crearDevolucionCompra(parsedInput, usuario);
    const dev = await getDevolucionCompra(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "devolucion_compra",
      entidad_id: id,
      detalle: `Devolución ${dev?.numero_devolucion ?? id} registrada por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "compra", "administracion"],
        tipo: "devolucion_compra_creada",
        titulo: `Devolución a proveedor ${dev?.numero_devolucion ?? ""} registrada`,
        mensaje: "Hay una devolución de compra pendiente de aprobación",
        entidad: "devolucion_compra",
        entidad_id: id,
      },
    });
    revalidarDevoluciones();
    return { id };
  });

export const aprobarDevolucionCompraAction = actionClient
  .inputSchema(procesarDevolucionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "compra", "administracion");
    const usuario = await requireUser();
    await aprobarDevolucionCompra(parsedInput.id, usuario);
    const dev = await getDevolucionCompra(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "aprobada",
      entidad: "devolucion_compra",
      entidad_id: parsedInput.id,
      detalle: `Devolución ${dev?.numero_devolucion ?? parsedInput.id} aprobada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarDevoluciones();
    return { ok: true };
  });

export const rechazarDevolucionCompraAction = actionClient
  .inputSchema(procesarDevolucionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "compra", "administracion");
    const usuario = await requireUser();
    await rechazarDevolucionCompra(parsedInput.id);
    const dev = await getDevolucionCompra(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "rechazada",
      entidad: "devolucion_compra",
      entidad_id: parsedInput.id,
      detalle: `Devolución ${dev?.numero_devolucion ?? parsedInput.id} rechazada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarDevoluciones();
    return { ok: true };
  });
