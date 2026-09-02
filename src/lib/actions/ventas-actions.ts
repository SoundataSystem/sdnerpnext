"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireRole, requirePermiso, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  crearClienteSchema,
  actualizarClienteSchema,
  crearOrdenSchema,
  actualizarOrdenSchema,
  eliminarOrdenSchema,
  registrarCobroSchema,
  facturarCajaMovimientoSchema,
  anularCajaMovimientoSchema,
  cambioEstadoOrdenSchema,
  registrarImpresionTicketSchema,
} from "@/lib/ventas/schema";
import {
  crearCliente,
  actualizarCliente,
  crearOrden,
  actualizarOrden,
  eliminarOrden,
  cambiarEstadoOrden,
  registrarCobro,
  anularCajaMovimiento,
  facturarCajaMovimiento,
  getProximoOrdenNumber,
} from "@/lib/ventas/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";
import { registrarActividad } from "@/lib/auditoria/repository";

const ROLES_VENTAS = ["admin", "vendedor", "cajero"] as const;
const ROLES_CAJA = ["admin", "cajero", "vendedor"] as const;

function revalidarVentas() {
  revalidatePath("/ventas", "layout");
}

// ─── Clientes ──────────────────────────────────────────────────────────────

export const crearClienteAction = actionClient
  .inputSchema(crearClienteSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const cliente = await crearCliente(parsedInput);
    revalidarVentas();
    return { id: cliente.id };
  });

export const actualizarClienteAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de cliente inválido"),
      data: actualizarClienteSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    await actualizarCliente(parsedInput.id, parsedInput.data);
    revalidarVentas();
    return { ok: true };
  });

// ─── Órdenes ───────────────────────────────────────────────────────────────

export const crearOrdenAction = actionClient
  .inputSchema(crearOrdenSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_VENTAS);
    const usuario = await requireUser();
    let vendedor = usuario;
    if (parsedInput.vendedor_id && parsedInput.vendedor_id !== usuario.id) {
      const seleccionado = await prisma.usuario.findUnique({
        where: { id: parsedInput.vendedor_id },
      });
      if (!seleccionado) {
        throw new Error("Vendedor seleccionado no encontrado");
      }
      if (seleccionado.rol !== "vendedor" && seleccionado.rol !== "admin") {
        throw new Error("El usuario seleccionado no es un vendedor");
      }
      vendedor = seleccionado;
    }
    const id = await crearOrden(parsedInput, vendedor);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "orden",
      entidad_id: id,
      detalle: `Orden de venta creada (vendedor ${vendedor.nombre} ${vendedor.apellido})`,
      notificar: {
        roles: ["admin", "cajero"],
        tipo: "venta_creada",
        titulo: "Nueva orden de venta",
        mensaje: `Se registró una orden pendiente de cobro`,
        entidad: "orden",
        entidad_id: id,
      },
    });
    revalidarVentas();
    return { id };
  });

export const completarOrdenAction = actionClient
  .inputSchema(cambioEstadoOrdenSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_VENTAS);
    const usuario = await requireUser();
    await cambiarEstadoOrden(parsedInput.id, "completada", {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    });
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "completada",
      entidad: "orden",
      entidad_id: parsedInput.id,
      detalle: `Orden de venta completada`,
    });
    revalidarVentas();
    return { ok: true };
  });

export const cancelarOrdenAction = actionClient
  .inputSchema(cambioEstadoOrdenSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await cambiarEstadoOrden(parsedInput.id, "cancelada", {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    });
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cancelada",
      entidad: "orden",
      entidad_id: parsedInput.id,
      detalle: `Orden de venta cancelada`,
      notificar: {
        roles: ["admin"],
        tipo: "venta_cancelada",
        titulo: "Orden de venta cancelada",
        mensaje: `Un vendedor canceló una orden`,
        entidad: "orden",
        entidad_id: parsedInput.id,
      },
    });
    revalidarVentas();
    return { ok: true };
  });

export const siguienteNumeroOrdenAction = actionClient.action(async () => {
  await requireRole(...ROLES_VENTAS);
  return { numero: await getProximoOrdenNumber() };
});

export const actualizarOrdenAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de orden inválido"),
      data: actualizarOrdenSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_VENTAS);
    const usuario = await requireUser();
    let vendedor = usuario;
    if (
      parsedInput.data.vendedor_id &&
      parsedInput.data.vendedor_id !== usuario.id
    ) {
      const seleccionado = await prisma.usuario.findUnique({
        where: { id: parsedInput.data.vendedor_id },
      });
      if (!seleccionado) {
        throw new Error("Vendedor seleccionado no encontrado");
      }
      if (seleccionado.rol !== "vendedor" && seleccionado.rol !== "admin") {
        throw new Error("El usuario seleccionado no es un vendedor");
      }
      vendedor = seleccionado;
    }
    await actualizarOrden(parsedInput.id, parsedInput.data, vendedor);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "actualizada",
      entidad: "orden",
      entidad_id: parsedInput.id,
      detalle: `Orden de venta actualizada`,
    });
    revalidarVentas();
    return { ok: true };
  });

export const eliminarOrdenAction = actionClient
  .inputSchema(eliminarOrdenSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin");
    const usuario = await requireUser();
    const res = await eliminarOrden(
      parsedInput.id,
      parsedInput.motivo,
      usuario,
    );
    // P4: operación destructiva admin — rastro en auditoría unificada.
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "eliminada",
      entidad: "orden",
      entidad_id: parsedInput.id,
      detalle: `Orden ${res.numero_orden} eliminada: ${parsedInput.motivo ?? "sin motivo"}`,
      notificar: {
        roles: ["admin"],
        tipo: "orden_eliminada",
        titulo: "Orden eliminada",
        mensaje: `${usuario.nombre} ${usuario.apellido} eliminó la orden ${res.numero_orden}`,
        entidad: "orden",
        entidad_id: parsedInput.id,
      },
    });
    revalidarVentas();
    return { numero_orden: res.numero_orden };
  });

// ─── Caja / Cobros ─────────────────────────────────────────────────────────

export const registrarCobroAction = actionClient
  .inputSchema(registrarCobroSchema)
  .action(async ({ parsedInput }) => {
    // Equivalente exacto a requireRole("admin","cajero","vendedor"):
    // rolesConPermiso("caja:cobrar") === {admin, cajero, vendedor}.
    await requirePermiso("caja", "cobrar");
    const usuario = await requireUser();
    const id = await registrarCobro(parsedInput, usuario);
    const mov = await prisma.cajaMovimiento.findUnique({
      where: { id },
      select: { orden_numero: true, monto_pagado: true },
    });
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cobrada",
      entidad: "caja_movimiento",
      entidad_id: id,
      detalle: `Cobro registrado para orden ${mov?.orden_numero ?? ""} por ₲${Number(mov?.monto_pagado ?? 0).toLocaleString()}`,
      notificar: {
        roles: ["admin"],
        tipo: "cobro_registrado",
        titulo: "Cobro registrado",
        mensaje: `Se registró un cobro en caja`,
        entidad: "caja_movimiento",
        entidad_id: id,
      },
    });
    revalidarVentas();
    return { id };
  });

export const anularCajaMovimientoAction = actionClient
  .inputSchema(anularCajaMovimientoSchema)
  .action(async ({ parsedInput }) => {
    // Equivalente exacto a requireRole("admin","cajero").
    await requirePermiso("caja", "anular");
    const usuario = await requireUser();
    await anularCajaMovimiento(parsedInput.id, parsedInput.motivo);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "anulada",
      entidad: "caja_movimiento",
      entidad_id: parsedInput.id,
      detalle: `Movimiento de caja anulado: ${parsedInput.motivo ?? "sin motivo"}`,
      notificar: {
        roles: ["admin"],
        tipo: "caja_anulada",
        titulo: "Movimiento de caja anulado",
        mensaje: `Un cajero anuló un movimiento de caja`,
        entidad: "caja_movimiento",
        entidad_id: parsedInput.id,
      },
    });
    revalidarVentas();
    return { ok: true };
  });

export const registrarImpresionTicketAction = actionClient
  .inputSchema(registrarImpresionTicketSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_VENTAS);
    const usuario = await requireUser();
    const orden = await prisma.orden.findUnique({
      where: { id: parsedInput.id },
      select: { numero_orden: true, total: true, moneda: true },
    });
    if (!orden) throw new Error("Orden no encontrada");
    await registrarActividad({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "impresa",
      entidad: "orden",
      entidad_id: parsedInput.id,
      detalle: `Ticket impreso (${parsedInput.formato}) para orden ${orden.numero_orden} por ${orden.moneda === "USD" ? "$" : "Gs. "}${Number(orden.total ?? 0).toLocaleString()}`,
    });
    return { ok: true };
  });

export const facturarCajaMovimientoAction = actionClient
  .inputSchema(facturarCajaMovimientoSchema)
  .action(async ({ parsedInput }) => {
    // Equivalente exacto a requireRole("admin","cajero","contabilidad").
    await requirePermiso("caja", "facturar");
    const usuario = await requireUser();
    await facturarCajaMovimiento(parsedInput.id, parsedInput.numero_factura);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "facturada",
      entidad: "caja_movimiento",
      entidad_id: parsedInput.id,
      detalle: `Movimiento facturado N° ${parsedInput.numero_factura}`,
      notificar: {
        roles: ["admin", "contabilidad"],
        tipo: "movimiento_facturado",
        titulo: "Movimiento facturado",
        mensaje: `Se facturó el movimiento N° ${parsedInput.numero_factura}`,
        entidad: "caja_movimiento",
        entidad_id: parsedInput.id,
      },
    });
    revalidarVentas();
    return { ok: true };
  });