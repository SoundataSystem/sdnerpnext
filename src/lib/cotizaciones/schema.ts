import { z } from "zod";

export const estadoCotizacionEnum = z.enum([
  "pendiente",
  "aprobada",
  "rechazada",
  "caducada",
]);
export type EstadoCotizacion = z.infer<typeof estadoCotizacionEnum>;

export const lineaCotizacionSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0").max(999999),
  precio_unitario: z.number().min(0, "El precio no puede ser negativo"),
});
export type LineaCotizacionInput = z.infer<typeof lineaCotizacionSchema>;

export const crearCotizacionSchema = z
  .object({
    cliente_id: z.string().uuid("ID de cliente inválido"),
    fecha_emision: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), {
        message: "Fecha inválida (formato esperado YYYY-MM-DD)",
      })
      .default(() => new Date().toISOString().split("T")[0]),
    fecha_vencimiento: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), {
        message: "Fecha inválida (formato esperado YYYY-MM-DD)",
      })
      .optional()
      .default(""),
    is_tax_included: z.boolean().optional().default(false),
    terms: z.string().trim().max(500).optional().default(""),
    descuento: z.number().min(0).optional().default(0),
    items: z
      .array(lineaCotizacionSchema)
      .min(1, "La cotización debe tener al menos 1 ítem")
      .max(300, "Máximo 300 ítems por cotización"),
  })
  .superRefine((val, ctx) => {
    const subtotal = val.items.reduce(
      (s, it) => s + it.cantidad * it.precio_unitario,
      0,
    );
    if (subtotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El subtotal debe ser mayor a 0",
        path: ["items"],
      });
    }
  });
export type CrearCotizacionInput = z.infer<typeof crearCotizacionSchema>;

export const cambiarEstadoCotizacionSchema = z.object({
  id: z.string().uuid("ID de cotización inválido"),
  estado: estadoCotizacionEnum,
});