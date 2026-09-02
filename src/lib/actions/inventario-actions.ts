"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireRole, requireUser } from "@/lib/auth";
import {
  crearProductoSchema,
  actualizarProductoSchema,
  crearDepositoSchema,
  actualizarDepositoSchema,
  crearAjusteStockSchema,
  aprobarAjusteSchema,
  rechazarAjusteSchema,
  cambiarEstadoProductoSchema,
  crearTransferenciaSchema,
} from "@/lib/inventario/schema";
import {
  crearProducto,
  actualizarProducto,
  crearDeposito,
  actualizarDeposito,
  eliminarDeposito,
  crearAjusteStock,
  aprobarAjusteStock,
  rechazarAjusteStock,
  transferirStock,
  getAjusteStock,
} from "@/lib/inventario/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";
import { prisma } from "@/lib/prisma";
import { crearNotificacionParaUsuario } from "@/lib/notificaciones/repository";

const ROLES_INVENTARIO = ["admin", "deposito", "administracion", "logistica"] as const;
const ROLES_APROBADOR = ["admin", "administracion", "logistica"] as const;
// Doc §7: Inventario (transferencias) → admin, cajero, deposito.
const ROLES_TRANSFERENCIA = [
  "admin",
  "deposito",
  "administracion",
  "logistica",
  "cajero",
] as const;

function revalidarInventario() {
  revalidatePath("/inventario", "layout");
  revalidatePath("/configuracion");
}

// ─── Productos ──────────────────────────────────────────────────────────────

export const crearProductoAction = actionClient
  .inputSchema(crearProductoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    const id = await crearProducto(parsedInput);
    revalidarInventario();
    return { id };
  });

export const actualizarProductoAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de producto inválido"),
      data: actualizarProductoSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    await actualizarProducto(parsedInput.id, parsedInput.data);
    revalidarInventario();
    return { ok: true };
  });

export const cambiarEstadoProductoAction = actionClient
  .inputSchema(cambiarEstadoProductoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    await actualizarProducto(parsedInput.id, { activo: parsedInput.activo });
    revalidarInventario();
    return { ok: true };
  });

// ─── Depósitos ──────────────────────────────────────────────────────────────

export const crearDepositoAction = actionClient
  .inputSchema(crearDepositoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    const id = await crearDeposito(parsedInput);
    revalidarInventario();
    return { id };
  });

export const actualizarDepositoAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de depósito inválido"),
      data: actualizarDepositoSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    await actualizarDeposito(parsedInput.id, parsedInput.data);
    revalidarInventario();
    return { ok: true };
  });

export const eliminarDepositoAction = actionClient
  .inputSchema(
    z.object({ id: z.string().uuid("ID de depósito inválido") }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    await eliminarDeposito(parsedInput.id);
    revalidarInventario();
    return { ok: true };
  });

// ─── Ajustes de stock ───────────────────────────────────────────────────────

export const crearAjusteStockAction = actionClient
  .inputSchema(crearAjusteStockSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_INVENTARIO);
    const usuario = await requireUser();
    const id = await crearAjusteStock(parsedInput, usuario);
    const ajuste = await getAjusteStock(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "ajuste_stock",
      entidad_id: id,
      detalle: `Ajuste ${ajuste?.numero_ajuste ?? id} creado por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "administracion", "logistica"],
        tipo: "ajuste_creado",
        titulo: `Ajuste de stock ${ajuste?.numero_ajuste ?? ""} pendiente`,
        mensaje: `${usuario.nombre} ${usuario.apellido} creó un ajuste que necesita aprobación`,
        entidad: "ajuste_stock",
        entidad_id: id,
      },
    });
    revalidarInventario();
    return { id };
  });

export const aprobarAjusteStockAction = actionClient
  .inputSchema(aprobarAjusteSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_APROBADOR);
    const usuario = await requireUser();
    await aprobarAjusteStock(parsedInput.id, usuario);
    const ajuste = await getAjusteStock(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "aprobada",
      entidad: "ajuste_stock",
      entidad_id: parsedInput.id,
      detalle: `Ajuste ${ajuste?.numero_ajuste ?? parsedInput.id} aprobado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarInventario();
    return { ok: true };
  });

export const rechazarAjusteStockAction = actionClient
  .inputSchema(rechazarAjusteSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_APROBADOR);
    const usuario = await requireUser();
    await rechazarAjusteStock(parsedInput.id, usuario);
    const ajuste = await getAjusteStock(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "rechazada",
      entidad: "ajuste_stock",
      entidad_id: parsedInput.id,
      detalle: `Ajuste ${ajuste?.numero_ajuste ?? parsedInput.id} rechazado por ${usuario.nombre} ${usuario.apellido}`,
    });
    // P4: avisar al creador del ajuste (el rechazo era invisible para él).
    const creador = await prisma.ajusteStock.findUnique({
      where: { id: parsedInput.id },
      select: { usuario_id: true, numero_ajuste: true },
    });
    if (creador?.usuario_id && creador.usuario_id !== usuario.id) {
      try {
        await crearNotificacionParaUsuario({
          usuario_id: creador.usuario_id,
          tipo_evento: "ajuste_rechazado",
          titulo: `Ajuste ${creador.numero_ajuste} rechazado`,
          mensaje: `${usuario.nombre} ${usuario.apellido} rechazó el ajuste que creaste`,
          entidad: "ajuste_stock",
          entidad_id: parsedInput.id,
        });
      } catch (error) {
        // Best-effort observable (P2-6): la falla no rompe la operación.
        console.error(
          "[notificaciones] fallo best-effort ajuste_rechazado",
          error,
        );
      }
    }
    revalidarInventario();
    return { ok: true };
  });

// ─── Transferencias entre depósitos ─────────────────────────────────────────

export const crearTransferenciaAction = actionClient
  .inputSchema(crearTransferenciaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_TRANSFERENCIA);
    const usuario = await requireUser();
    const res = await transferirStock(parsedInput, usuario);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "transferencia",
      detalle: `Transferencia de ${res.movimientos} ítem(s) entre depósitos por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarInventario();
    return res;
  });