"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireRole, requireUser } from "@/lib/auth";
import {
  crearAsientoSchema,
  crearCuentaSchema,
  actualizarCuentaSchema,
  contabilizarAsientoSchema,
  anularAsientoSchema,
  libroMayorFiltroSchema,
  balanceFiltroSchema,
} from "@/lib/contabilidad/schema";
import {
  crearCuenta,
  actualizarCuenta,
  crearAsiento,
  contabilizarAsiento,
  anularAsiento,
  getProximoAsientoNumber,
  getLibroMayor,
  getBalanceComprobacion,
  getAsiento,
} from "@/lib/contabilidad/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

const ROLES_CONTABILIDAD = ["admin", "contabilidad"] as const;

function revalidarContabilidad() {
  revalidatePath("/contabilidad", "layout");
}

// ─── Plan de Cuentas ──────────────────────────────────────────────────────

export const crearCuentaAction = actionClient
  .inputSchema(crearCuentaSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    const usuario = await requireUser();
    const cuenta = await crearCuenta(parsedInput);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "cuenta_contable",
      entidad_id: cuenta.id,
      detalle: `Cuenta contable ${cuenta.codigo} - ${cuenta.nombre} creada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarContabilidad();
    return { id: cuenta.id };
  });

export const actualizarCuentaAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid("ID de cuenta inválido"),
      data: actualizarCuentaSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    const usuario = await requireUser();
    await actualizarCuenta(parsedInput.id, parsedInput.data);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "actualizada",
      entidad: "cuenta_contable",
      entidad_id: parsedInput.id,
      detalle: `Cuenta contable ${parsedInput.id} actualizada por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarContabilidad();
    return { ok: true };
  });

// ─── Asientos ─────────────────────────────────────────────────────────────

export const crearAsientoAction = actionClient
  .inputSchema(crearAsientoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    const usuario = await requireUser();
    const id = await crearAsiento(parsedInput);
    const asiento = await getAsiento(id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creado",
      entidad: "asiento_contable",
      entidad_id: id,
      detalle: `Asiento ${asiento?.numero_asiento ?? id} creado por ${usuario.nombre} ${usuario.apellido}`,
      notificar: {
        roles: ["admin", "contabilidad"],
        tipo: "asiento_creado",
        titulo: `Asiento ${asiento?.numero_asiento ?? ""} creado`,
        mensaje: "Hay un asiento pendiente de contabilizar",
        entidad: "asiento_contable",
        entidad_id: id,
      },
    });
    revalidarContabilidad();
    return { id };
  });

export const contabilizarAsientoAction = actionClient
  .inputSchema(contabilizarAsientoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    const usuario = await requireUser();
    await contabilizarAsiento(parsedInput.id);
    const asiento = await getAsiento(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "contabilizado",
      entidad: "asiento_contable",
      entidad_id: parsedInput.id,
      detalle: `Asiento ${asiento?.numero_asiento ?? parsedInput.id} contabilizado por ${usuario.nombre} ${usuario.apellido}`,
    });
    revalidarContabilidad();
    return { ok: true };
  });

export const anularAsientoAction = actionClient
  .inputSchema(anularAsientoSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    const usuario = await requireUser();
    await anularAsiento(parsedInput.id, parsedInput.motivo);
    const asiento = await getAsiento(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "anulado",
      entidad: "asiento_contable",
      entidad_id: parsedInput.id,
      detalle: `Asiento ${asiento?.numero_asiento ?? parsedInput.id} anulado por ${usuario.nombre} ${usuario.apellido}: ${parsedInput.motivo}`,
    });
    revalidarContabilidad();
    return { ok: true };
  });

export const siguienteNumeroAsientoAction = actionClient.action(async () => {
  await requireRole(...ROLES_CONTABILIDAD);
  return { numero: await getProximoAsientoNumber() };
});

// ─── Reportes ─────────────────────────────────────────────────────────────

export const getLibroMayorAction = actionClient
  .inputSchema(libroMayorFiltroSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    return getLibroMayor(
      parsedInput.cuenta_id,
      parsedInput.desde,
      parsedInput.hasta,
    );
  });

export const getBalanceComprobacionAction = actionClient
  .inputSchema(balanceFiltroSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ROLES_CONTABILIDAD);
    return getBalanceComprobacion(parsedInput.desde, parsedInput.hasta);
  });
