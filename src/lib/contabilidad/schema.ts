import { z } from "zod";

export const tipoCuentaEnum = z.enum([
  "activo",
  "pasivo",
  "patrimonio",
  "ingreso",
  "gasto",
]);
export type TipoCuenta = z.infer<typeof tipoCuentaEnum>;

export const estadoAsientoEnum = z.enum([
  "borrador",
  "contabilizado",
  "cancelado",
]);
export type EstadoAsiento = z.infer<typeof estadoAsientoEnum>;

export const estadoCuentaEnum = z.enum([
  "pendiente",
  "parcial",
  "pagado",
  "cancelado",
]);
export type EstadoCuenta = z.infer<typeof estadoCuentaEnum>;

// ─── Plan de Cuentas ─────────────────────────────────────────────────────

export const crearCuentaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, "Código de cuenta requerido")
    .max(50, "Máximo 50 caracteres"),
  nombre: z
    .string()
    .trim()
    .min(1, "Nombre de cuenta requerido")
    .max(200, "Máximo 200 caracteres"),
  tipo: tipoCuentaEnum,
  nivel: z.number().int("Nivel debe ser entero").min(0).max(10).optional().default(0),
  padre_id: z.string().uuid("ID de padre inválido").nullable().optional(),
  activo: z.boolean().optional().default(true),
});
export type CrearCuentaInput = z.infer<typeof crearCuentaSchema>;

export const actualizarCuentaSchema = crearCuentaSchema.partial();
export type ActualizarCuentaInput = z.infer<typeof actualizarCuentaSchema>;

// ─── Línea de asiento ────────────────────────────────────────────────────

export const lineaAsientoSchema = z
  .object({
    cuenta_id: z.string().uuid("ID de cuenta inválido"),
    debe: z.number().min(0, "Debe no puede ser negativo").default(0),
    haber: z.number().min(0, "Haber no puede ser negativo").default(0),
  })
  .refine((d) => !(d.debe > 0 && d.haber > 0), {
    message: "Una línea no puede tener debe y haber simultáneamente",
  })
  .refine((d) => d.debe > 0 || d.haber > 0, {
    message: "La línea debe tener debe o haber mayor a 0",
  });
export type LineaAsientoInput = z.infer<typeof lineaAsientoSchema>;

// ─── Crear Asiento (encabezado + líneas) ────────────────────────────────

export const crearAsientoSchema = z
  .object({
    asiento: z.object({
      numero_asiento: z
        .string()
        .trim()
        .min(1, "Número de asiento requerido")
        .max(50),
      fecha: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)), {
          message: "Fecha inválida (formato esperado YYYY-MM-DD)",
        })
        .default(() => new Date().toISOString().split("T")[0]),
      concepto: z
        .string()
        .trim()
        .min(1, "Concepto requerido")
        .max(500, "Máximo 500 caracteres"),
      referencia_tipo: z.string().max(50).nullable().optional(),
      referencia_id: z.string().max(100).nullable().optional(),
      estado: estadoAsientoEnum.default("borrador"),
    }),
    detalles: z
      .array(lineaAsientoSchema)
      .min(2, "Un asiento debe tener al menos 2 líneas (partida doble)")
      .max(200, "Máximo 200 líneas por asiento"),
  })
  .superRefine((val, ctx) => {
    const totalDebe = val.detalles.reduce((s, d) => s + d.debe, 0);
    const totalHaber = val.detalles.reduce((s, d) => s + d.haber, 0);
    if (totalDebe !== totalHaber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El asiento no cuadra: Debe=₲${totalDebe.toLocaleString()} Haber=₲${totalHaber.toLocaleString()} (diferencia ₲${Math.abs(totalDebe - totalHaber).toLocaleString()})`,
        path: ["detalles"],
      });
    }
    if (totalDebe === 0 && totalHaber === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El asiento no tiene montos",
        path: ["detalles"],
      });
    }
  });
export type CrearAsientoInput = z.infer<typeof crearAsientoSchema>;

// ─── Acciones de estado ──────────────────────────────────────────────────

export const contabilizarAsientoSchema = z.object({
  id: z.string().uuid("ID de asiento inválido"),
});

export const anularAsientoSchema = z.object({
  id: z.string().uuid("ID de asiento inválido"),
  motivo: z
    .string()
    .trim()
    .min(1, "El motivo de anulación es obligatorio")
    .max(500, "Máximo 500 caracteres"),
});

export const libroMayorFiltroSchema = z.object({
  cuenta_id: z.string().uuid("ID de cuenta inválido").optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

export const balanceFiltroSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});
