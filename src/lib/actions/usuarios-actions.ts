"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireRole } from "@/lib/auth";
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  vincularUsuarioSchema,
} from "@/lib/usuarios/schema";
import {
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  vincularAuthUser,
} from "@/lib/usuarios/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

function revalidarUsuarios() {
  revalidatePath("/usuarios");
}

export const crearUsuarioAction = actionClient
  .inputSchema(crearUsuarioSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireRole("admin");
    const id = await crearUsuario(parsedInput);
    await notificarYAcreditar({
      usuario_id: actor.id,
      usuario_nombre: `${actor.nombre} ${actor.apellido}`,
      accion: "creado",
      entidad: "usuario",
      entidad_id: id,
      detalle: `Usuario creado: ${parsedInput.nombre} ${parsedInput.apellido}`,
    });
    revalidarUsuarios();
    return { id };
  });

export const actualizarUsuarioAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de usuario inválido"),
      data: actualizarUsuarioSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    const actor = await requireRole("admin");
    await actualizarUsuario(parsedInput.id, parsedInput.data);
    await notificarYAcreditar({
      usuario_id: actor.id,
      usuario_nombre: `${actor.nombre} ${actor.apellido}`,
      accion: "actualizado",
      entidad: "usuario",
      entidad_id: parsedInput.id,
      detalle: `Usuario actualizado (${parsedInput.id})`,
    });
    revalidarUsuarios();
    return { ok: true };
  });

export const cambiarEstadoUsuarioAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de usuario inválido"),
      activo: z.boolean(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const actor = await requireRole("admin");
    await cambiarEstadoUsuario(parsedInput.id, parsedInput.activo);
    await notificarYAcreditar({
      usuario_id: actor.id,
      usuario_nombre: `${actor.nombre} ${actor.apellido}`,
      accion: parsedInput.activo ? "activado" : "desactivado",
      entidad: "usuario",
      entidad_id: parsedInput.id,
      detalle: `Usuario ${parsedInput.activo ? "activado" : "desactivado"}`,
    });
    revalidarUsuarios();
    return { ok: true };
  });

export const vincularUsuarioAction = actionClient
  .inputSchema(vincularUsuarioSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireRole("admin");
    await vincularAuthUser(
      parsedInput.usuario_id,
      parsedInput.auth_user_id,
    );
    await notificarYAcreditar({
      usuario_id: actor.id,
      usuario_nombre: `${actor.nombre} ${actor.apellido}`,
      accion: "vinculado",
      entidad: "usuario",
      entidad_id: parsedInput.usuario_id,
      detalle: `Usuario vinculado a auth_user ${parsedInput.auth_user_id}`,
    });
    revalidarUsuarios();
    return { ok: true };
  });
