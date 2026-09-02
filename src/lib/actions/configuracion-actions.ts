"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireRole } from "@/lib/auth";
import {
  actualizarConfiguracionSchema,
  crearMetodoPagoSchema,
  actualizarMetodoPagoSchema,
  eliminarMetodoPagoSchema,
} from "@/lib/configuracion/schema";
import {
  actualizarConfiguracion,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago,
} from "@/lib/configuracion/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

export const actualizarConfiguracionAction = actionClient
  .inputSchema(actualizarConfiguracionSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireRole("admin");
    await actualizarConfiguracion(parsedInput, user.id);
    await notificarYAcreditar({
      usuario_id: user.id,
      usuario_nombre: `${user.nombre} ${user.apellido}`,
      accion: "actualizada",
      entidad: "configuracion",
      entidad_id: user.id,
      detalle: `Configuración del sistema actualizada`,
    });
    revalidatePath("/configuracion");
    return { ok: true };
  });

export const crearMetodoPagoAction = actionClient
  .inputSchema(crearMetodoPagoSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireRole("admin");
    const id = await crearMetodoPago(parsedInput);
    await notificarYAcreditar({
      usuario_id: user.id,
      usuario_nombre: `${user.nombre} ${user.apellido}`,
      accion: "creada",
      entidad: "metodo_pago",
      entidad_id: id,
      detalle: `Método de pago "${parsedInput.nombre}" creado`,
    });
    revalidatePath("/configuracion");
    return { id };
  });

export const actualizarMetodoPagoAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de método de pago inválido"),
      data: actualizarMetodoPagoSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    const user = await requireRole("admin");
    await actualizarMetodoPago(parsedInput.id, parsedInput.data);
    await notificarYAcreditar({
      usuario_id: user.id,
      usuario_nombre: `${user.nombre} ${user.apellido}`,
      accion: "actualizada",
      entidad: "metodo_pago",
      entidad_id: parsedInput.id,
      detalle: `Método de pago actualizado`,
    });
    revalidatePath("/configuracion");
    return { ok: true };
  });

export const eliminarMetodoPagoAction = actionClient
  .inputSchema(eliminarMetodoPagoSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireRole("admin");
    await eliminarMetodoPago(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: user.id,
      usuario_nombre: `${user.nombre} ${user.apellido}`,
      accion: "eliminada",
      entidad: "metodo_pago",
      entidad_id: parsedInput.id,
      detalle: `Método de pago eliminado`,
    });
    revalidatePath("/configuracion");
    return { ok: true };
  });