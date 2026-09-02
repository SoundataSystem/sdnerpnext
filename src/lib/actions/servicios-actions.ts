"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireRole, requireUser } from "@/lib/auth";
import {
  crearTecnicoSchema,
  actualizarTecnicoSchema,
  cambiarEstadoTecnicoSchema,
  crearOrdenServicioSchema,
  cambiarEstadoOrdenServicioSchema,
  asignarTecnicoSchema,
  crearInstalacionSchema,
  cambiarEstadoInstalacionSchema,
  registrarGarantiaSchema,
  validarGarantiaSchema,
  crearTicketSchema,
  cambiarEstadoTicketSchema,
  crearRmaSchema,
  avanzarRmaSchema,
} from "@/lib/servicios/schema";
import {
  crearTecnico,
  actualizarTecnico,
  cambiarEstadoTecnico,
  crearOrdenServicio,
  cambiarEstadoOrdenServicio,
  asignarTecnico,
  crearInstalacion,
  cambiarEstadoInstalacion,
  registrarGarantia,
  validarGarantia,
  crearTicket,
  cambiarEstadoTicket,
  crearRma,
  avanzarRma,
  getRmas,
  getTecnicos,
  getOrdenServicio,
  getGarantias,
  getTickets,
} from "@/lib/servicios/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

// Rol "tecnico" no existe en el enum Prisma Rol (schema.prisma) → se usan los
// roles reales de soporte: servicio_tecnico y supervisor_tecnico.
const ROLES_SERVICIOS = [
  "admin",
  "vendedor",
  "servicio_tecnico",
  "supervisor_tecnico",
] as const;

function revalidarServicios() {
  revalidatePath("/servicios", "layout");
}

// ─── Técnicos ───────────────────────────────────────────────────────────────

export const crearTecnicoAction = actionClient
  .inputSchema(crearTecnicoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    const id = await crearTecnico(parsedInput);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creado",
      entidad: "tecnico",
      entidad_id: id,
      detalle: `Técnico ${parsedInput.nombre} creado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

export const actualizarTecnicoAction = actionClient
  .inputSchema(
    z.object({
      id: cambiarEstadoTecnicoSchema.shape.id,
      data: actualizarTecnicoSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole("admin");
    const usuario = await requireUser();
    await actualizarTecnico(parsedInput.id, parsedInput.data);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "actualizado",
      entidad: "tecnico",
      entidad_id: parsedInput.id,
      detalle: `Técnico ${parsedInput.id} actualizado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

export const cambiarEstadoTecnicoAction = actionClient
  .inputSchema(cambiarEstadoTecnicoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await cambiarEstadoTecnico(parsedInput.id);
    const tecnico = (await getTecnicos()).find((t) => t.id === parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cambiado",
      entidad: "tecnico",
      entidad_id: parsedInput.id,
      detalle: `Estado del técnico ${tecnico?.nombre ?? parsedInput.id} cambiado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

// ─── Órdenes de servicio ────────────────────────────────────────────────────

export const crearOrdenServicioAction = actionClient
  .inputSchema(crearOrdenServicioSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_SERVICIOS);
    const usuario = await requireUser();
    const id = await crearOrdenServicio(parsedInput, usuario);
    const orden = await getOrdenServicio(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "orden_servicio",
      entidad_id: id,
      detalle: `OTS ${orden?.numero_orden ?? id} creada por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "servicio_tecnico", "supervisor_tecnico"],
        tipo: "ots_creada",
        titulo: `Nueva orden de servicio ${orden?.numero_orden ?? ""}`,
        mensaje: "Hay una orden de servicio pendiente de gestión",
        entidad: "orden_servicio",
        entidad_id: id,
      },
    });
    revalidarServicios();
    return { id };
  });

export const cambiarEstadoOrdenServicioAction = actionClient
  .inputSchema(cambiarEstadoOrdenServicioSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_SERVICIOS);
    const usuario = await requireUser();
    await cambiarEstadoOrdenServicio(parsedInput.id, parsedInput.estado);
    const orden = await getOrdenServicio(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cambiado_estado",
      entidad: "orden_servicio",
      entidad_id: parsedInput.id,
      detalle: `OTS ${orden?.numero_orden ?? parsedInput.id} → ${parsedInput.estado} por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

export const asignarTecnicoAction = actionClient
  .inputSchema(asignarTecnicoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await asignarTecnico(parsedInput.id, parsedInput.tecnico_id);
    const orden = await getOrdenServicio(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "tecnico_asignado",
      entidad: "orden_servicio",
      entidad_id: parsedInput.id,
      detalle: `Técnico asignado a la OTS ${orden?.numero_orden ?? parsedInput.id} por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

// ─── Instalaciones ──────────────────────────────────────────────────────────

export const crearInstalacionAction = actionClient
  .inputSchema(crearInstalacionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    const id = await crearInstalacion(parsedInput);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "instalacion",
      entidad_id: id,
      detalle: `Instalación ${id} programada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { id };
  });

export const cambiarEstadoInstalacionAction = actionClient
  .inputSchema(cambiarEstadoInstalacionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await cambiarEstadoInstalacion(parsedInput.id, parsedInput.estado);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cambiado_estado",
      entidad: "instalacion",
      entidad_id: parsedInput.id,
      detalle: `Instalación ${parsedInput.id} → ${parsedInput.estado} por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

// ─── Garantías ──────────────────────────────────────────────────────────────

export const registrarGarantiaAction = actionClient
  .inputSchema(registrarGarantiaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    const id = await registrarGarantia(parsedInput);
    const garantia = (await getGarantias()).find((g) => g.id === id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "registrada",
      entidad: "garantia",
      entidad_id: id,
      detalle: `Garantía ${garantia?.codigo_garantia ?? id} registrada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { id };
  });

export const validarGarantiaAction = actionClient
  .inputSchema(validarGarantiaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await validarGarantia(parsedInput.id, parsedInput.valida, usuario);
    const garantia = (await getGarantias()).find((g) => g.id === parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: parsedInput.valida ? "validada" : "rechazada",
      entidad: "garantia",
      entidad_id: parsedInput.id,
      detalle: `Garantía ${garantia?.codigo_garantia ?? parsedInput.id} ${parsedInput.valida ? "validada" : "rechazada"} por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

// ─── Tickets de soporte ─────────────────────────────────────────────────────

export const crearTicketAction = actionClient
  .inputSchema(crearTicketSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_SERVICIOS);
    const usuario = await requireUser();
    const id = await crearTicket(parsedInput, usuario);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "ticket_soporte",
      entidad_id: id,
      detalle: `Ticket ${parsedInput.asunto ?? id} creado por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "servicio_tecnico", "supervisor_tecnico"],
        tipo: "ticket_creado",
        titulo: "Nuevo ticket de soporte",
        mensaje: parsedInput.asunto ?? "Se registró un nuevo ticket",
        entidad: "ticket_soporte",
        entidad_id: id,
      },
    });
    revalidarServicios();
    return { id };
  });

export const cambiarEstadoTicketAction = actionClient
  .inputSchema(cambiarEstadoTicketSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_SERVICIOS);
    const usuario = await requireUser();
    await cambiarEstadoTicket(parsedInput.id, parsedInput.estado);
    const ticket = (await getTickets()).find((t) => t.id === parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "cambiado_estado",
      entidad: "ticket_soporte",
      entidad_id: parsedInput.id,
      detalle: `Ticket ${ticket?.numero_ticket ?? parsedInput.id} → ${parsedInput.estado} por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });

// ─── RMA ────────────────────────────────────────────────────────────────────

export const crearRmaAction = actionClient
  .inputSchema(crearRmaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_SERVICIOS);
    const usuario = await requireUser();
    const id = await crearRma(parsedInput, usuario);
    const rma = (await getRmas()).find((r) => r.id === id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "rma",
      entidad_id: id,
      detalle: `RMA ${rma?.numero_rma ?? id} creado por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "supervisor_tecnico", "servicio_tecnico"],
        tipo: "rma_creado",
        titulo: `Nuevo RMA ${rma?.numero_rma ?? ""} pendiente`,
        mensaje: "Hay un RMA que necesita gestión",
        entidad: "rma",
        entidad_id: id,
      },
    });
    revalidarServicios();
    return { id };
  });

export const avanzarRmaAction = actionClient
  .inputSchema(avanzarRmaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_SERVICIOS);
    const usuario = await requireUser();
    await avanzarRma(parsedInput, usuario);
    const rma = (await getRmas()).find((r) => r.id === parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "avanzado",
      entidad: "rma",
      entidad_id: parsedInput.id,
      detalle: `RMA ${rma?.numero_rma ?? parsedInput.id} → ${rma?.estado ?? ""} (${parsedInput.accion}) por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarServicios();
    return { ok: true };
  });
