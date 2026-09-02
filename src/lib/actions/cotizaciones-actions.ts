"use server";

import { revalidatePath } from "next/cache";
import { actionClient } from "@/lib/safe-action";
import { requireRole, requirePermiso, requireUser } from "@/lib/auth";
import {
  crearCotizacionSchema,
  cambiarEstadoCotizacionSchema,
} from "@/lib/cotizaciones/schema";
import {
  crearCotizacion,
  cambiarEstadoCotizacion,
  getCotizacion,
} from "@/lib/cotizaciones/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

const ROLES_COTIZACION = ["admin", "vendedor", "cajero"] as const;

function revalidarCotizaciones() {
  revalidatePath("/cotizaciones", "layout");
}

export const crearCotizacionAction = actionClient
  .inputSchema(crearCotizacionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_COTIZACION);
    const usuario = await requireUser();
    const res = await crearCotizacion(parsedInput, usuario);
    const id = res.id;
    const cotizacion = await getCotizacion(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "cotizacion",
      entidad_id: id,
      detalle: `Cotización ${cotizacion?.numero_cotizacion ?? id} creada por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "vendedor"],
        tipo: "cotizacion_creada",
        titulo: `Cotización ${cotizacion?.numero_cotizacion ?? ""} creada`,
        mensaje: `${usuario.nombre} ${usuario.apellido} registró una cotización`,
        entidad: "cotizacion",
        entidad_id: id,
      },
    });
    revalidarCotizaciones();
    return { id, advertencias: res.advertencias };
  });

export const aprobarCotizacionAction = actionClient
  .inputSchema(cambiarEstadoCotizacionSchema)
  .action(async ({ parsedInput }) => {
    // Equivalente exacto a requireRole("admin", "vendedor"):
    // rolesConPermiso("cotizaciones:aprobar") === {admin, vendedor}.
    await requirePermiso("cotizaciones", "aprobar");
    const usuario = await requireUser();
    await cambiarEstadoCotizacion(parsedInput.id, "aprobada");
    const cotizacion = await getCotizacion(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "aprobada",
      entidad: "cotizacion",
      entidad_id: parsedInput.id,
      detalle: `Cotización ${cotizacion?.numero_cotizacion ?? parsedInput.id} aprobada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCotizaciones();
    return { ok: true };
  });

export const rechazarCotizacionAction = actionClient
  .inputSchema(cambiarEstadoCotizacionSchema)
  .action(async ({ parsedInput }) => {
    // Equivalente exacto a requireRole("admin", "vendedor"):
    // rolesConPermiso("cotizaciones:aprobar") incluye admin,vendedor para rechazo.
    await requirePermiso("cotizaciones", "aprobar");
    const usuario = await requireUser();
    await cambiarEstadoCotizacion(parsedInput.id, "rechazada");
    const cotizacion = await getCotizacion(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "rechazada",
      entidad: "cotizacion",
      entidad_id: parsedInput.id,
      detalle: `Cotización ${cotizacion?.numero_cotizacion ?? parsedInput.id} rechazada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCotizaciones();
    return { ok: true };
  });

export const caducarCotizacionAction = actionClient
  .inputSchema(cambiarEstadoCotizacionSchema)
  .action(async ({ parsedInput }) => {
    await requireRole("admin", "vendedor");
    const usuario = await requireUser();
    await cambiarEstadoCotizacion(parsedInput.id, "caducada");
    const cotizacion = await getCotizacion(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "caducada",
      entidad: "cotizacion",
      entidad_id: parsedInput.id,
      detalle: `Cotización ${cotizacion?.numero_cotizacion ?? parsedInput.id} caducada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarCotizaciones();
    return { ok: true };
  });
