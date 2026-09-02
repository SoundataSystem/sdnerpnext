import { z } from "zod";

export const estadoDevolucionEnum = z.enum([
  "pendiente",
  "aprobada",
  "rechazada",
]);
export type EstadoDevolucion = z.infer<typeof estadoDevolucionEnum>;

export const itemDevolucionSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z
    .number()
    .int("La cantidad debe ser entera")
    .positive("La cantidad debe ser mayor a 0")
    .max(999999),
  precio_unitario: z.number().min(0, "El precio no puede ser negativo"),
});
export type ItemDevolucionInput = z.infer<typeof itemDevolucionSchema>;

export const crearDevolucionVentaSchema = z
  .object({
    orden_id: z.string().uuid("ID de orden inválido"),
    motivo: z.string().trim().min(3, "Indica el motivo").max(500),
    items: z
      .array(itemDevolucionSchema)
      .min(1, "La devolución debe tener al menos 1 ítem")
      .max(300, "Máximo 300 ítems por devolución"),
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
export type CrearDevolucionVentaInput = z.infer<
  typeof crearDevolucionVentaSchema
>;

export const crearDevolucionCompraSchema = z
  .object({
    orden_compra_id: z.string().uuid("ID de orden de compra inválido"),
    proveedor_id: z.string().uuid("ID de proveedor inválido"),
    motivo: z.string().trim().min(3, "Indica el motivo").max(500),
    items: z
      .array(itemDevolucionSchema)
      .min(1, "La devolución debe tener al menos 1 ítem")
      .max(300, "Máximo 300 ítems por devolución"),
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
export type CrearDevolucionCompraInput = z.infer<
  typeof crearDevolucionCompraSchema
>;

export const procesarDevolucionSchema = z.object({
  id: z.string().uuid("ID de devolución inválido"),
});