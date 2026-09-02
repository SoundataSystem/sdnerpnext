"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { actionClient } from "@/lib/safe-action";
import { requirePermiso } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { procesarLote, revertirImportacion } from "@/lib/pegasus/importer";
import { notificarYAcreditar } from "@/lib/sistema/hooks";

const MAX_LOG = 1500;
const tipoPegasus = z.enum(["clientes", "proveedores", "productos", "stock", "seriales"]);

const procesarLotePegasusSchema = z.object({
  importacionId: z.string().uuid().optional(),
  tipo: tipoPegasus,
  cabecera: z.string().max(20000).optional().default(""),
  cuerpo: z.string().min(1, "El lote no puede estar vacío"),
  filaInicio: z.number().int().min(0).optional().default(0),
});

export const procesarLotePegasusAction = actionClient
  .schema(procesarLotePegasusSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requirePermiso("pegasus", "importar");
    const res = await procesarLote(
      parsedInput.tipo,
      parsedInput.cabecera,
      parsedInput.cuerpo,
      parsedInput.filaInicio,
    );
    const importacionId = parsedInput.importacionId ?? randomUUID();
    const prev = await prisma.importacionPegasus.findUnique({
      where: { id: importacionId },
      select: { log_detalle: true },
    });
    if (!prev) {
      const creado = await prisma.importacionPegasus.create({
        data: {
          id: importacionId,
          tipo: parsedInput.tipo,
          archivo_nombre: "en proceso...",
          estado: "parcial",
          filas_total: res.filas_total,
          filas_ok: res.filas_ok,
          filas_warning: res.filas_warning,
          filas_error: res.filas_error,
          usuario_id: usuario.id,
          log_detalle: {
            log: res.log,
            creados: res.creados,
            actualizados: res.actualizados,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return {
        importacionId: creado.id,
        filas_ok: res.filas_ok,
        filas_warning: res.filas_warning,
        filas_error: res.filas_error,
        log: res.log.slice(0, 60),
      };
    }
    const detallePrevio = (prev.log_detalle ?? {}) as {
      log?: string[];
      creados?: { clientes?: string[]; proveedores?: string[]; productos?: string[]; seriales?: string[] };
      actualizados?: {
        clientes?: Array<{ id: string; antes: Record<string, unknown> }>;
        proveedores?: Array<{ id: string; antes: Record<string, unknown> }>;
        productos?: Array<{ id: string; antes: Record<string, unknown> }>;
        stock?: Array<{ id: string; antes: Record<string, unknown> }>;
      };
    };
    const log = [...(detallePrevio.log ?? []), ...res.log].slice(-MAX_LOG);
    const creados = {
      clientes: [...(detallePrevio.creados?.clientes ?? []), ...res.creados.clientes],
      proveedores: [...(detallePrevio.creados?.proveedores ?? []), ...res.creados.proveedores],
      productos: [...(detallePrevio.creados?.productos ?? []), ...res.creados.productos],
      seriales: [...(detallePrevio.creados?.seriales ?? []), ...res.creados.seriales],
    };
    const actualizados = {
      clientes: [...(detallePrevio.actualizados?.clientes ?? []), ...(res.actualizados.clientes ?? [])],
      proveedores: [...(detallePrevio.actualizados?.proveedores ?? []), ...(res.actualizados.proveedores ?? [])],
      productos: [...(detallePrevio.actualizados?.productos ?? []), ...(res.actualizados.productos ?? [])],
      stock: [...(detallePrevio.actualizados?.stock ?? []), ...(res.actualizados.stock ?? [])],
    };
    await prisma.importacionPegasus.update({
      where: { id: importacionId },
      data: {
        filas_total: { increment: res.filas_total },
        filas_ok: { increment: res.filas_ok },
        filas_warning: { increment: res.filas_warning },
        filas_error: { increment: res.filas_error },
        log_detalle: { log, creados, actualizados } as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      importacionId,
      filas_ok: res.filas_ok,
      filas_warning: res.filas_warning,
      filas_error: res.filas_error,
      log: res.log.slice(0, 60),
    };
  });

const finalizarImportacionPegasusSchema = z.object({
  importacionId: z.string().uuid(),
  archivo_nombre: z.string().trim().max(200).optional().default(""),
});

export const finalizarImportacionPegasusAction = actionClient
  .schema(finalizarImportacionPegasusSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requirePermiso("pegasus", "importar");
    const imp = await prisma.importacionPegasus.findUnique({
      where: { id: parsedInput.importacionId },
    });
    if (!imp) throw new Error("Importación no encontrada");

    const estado =
      (imp.filas_error ?? 0) === 0 && (imp.filas_ok ?? 0) > 0
        ? "completada"
        : "parcial";

    await prisma.importacionPegasus.update({
      where: { id: imp.id },
      data: {
        estado,
        archivo_nombre: parsedInput.archivo_nombre || "pegar / subir",
      },
    });

    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "creada",
      entidad: "importacion_pegasus",
      entidad_id: imp.id,
      detalle: `Importación ${imp.tipo} (${parsedInput.archivo_nombre || "manual"})`,
      notificar: {
        roles: ["admin"],
        tipo: "importacion_pegasus",
        titulo: `Importación ${imp.tipo} (${parsedInput.archivo_nombre || "manual"})`,
        mensaje: `${imp.filas_ok} ok, ${imp.filas_warning} avisos, ${imp.filas_error} errores`,
        entidad: "importacion_pegasus",
        entidad_id: imp.id,
      },
    });

    return { id: imp.id, estado };
  });

const revertirImportacionSchema = z.object({
  id: z.string().uuid(),
});

export const revertirImportacionAction = actionClient
  .schema(revertirImportacionSchema)
  .action(async ({ parsedInput }) => {
    const usuario = await requirePermiso("pegasus", "importar");
    const res = await revertirImportacion(parsedInput.id);
    await notificarYAcreditar({
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`,
      accion: "revertida",
      entidad: "importacion_pegasus",
      entidad_id: parsedInput.id,
      detalle: `Se eliminaron ${res.eliminados} registros creados`,
    });
    return res;
  });