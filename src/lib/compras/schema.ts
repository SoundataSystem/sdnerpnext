import { z } from "zod";

export const estadoOrdenCompraEnum = z.enum([
  "pendiente",
  "borrador",
  "pendiente_aprobacion",
  "aprobada",
  "enviada",
  "recepcion_parcial",
  "recepcion_completa",
  "pendiente_ingreso_stock",
  "ingresada",
  "cerrada",
  "cancelada",
]);
export type EstadoOrdenCompra = z.infer<typeof estadoOrdenCompraEnum>;

// ─── Proveedores ───────────────────────────────────────────────────────────

export const crearProveedorSchema = z.object({
  supplier: z
    .string()
    .trim()
    .min(1, "Nombre del proveedor requerido")
    .max(200, "Máximo 200 caracteres"),
  tax: z.string().trim().max(50).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  document_type: z.string().trim().max(20).optional().default("RUC"),
  term: z.string().trim().max(100).optional().default(""),
  condition_description: z.string().trim().max(200).optional().default(""),
  tiene_acuerdo_comercial: z.boolean().optional().default(false),
});
export type CrearProveedorInput = z.infer<typeof crearProveedorSchema>;

export const actualizarProveedorSchema = crearProveedorSchema.partial();
export type ActualizarProveedorInput = z.infer<typeof actualizarProveedorSchema>;

// ─── Línea de OC ───────────────────────────────────────────────────────────

export const lineaOcSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0").max(999999),
  unit_price: z.number().min(0, "El precio no puede ser negativo"),
});
export type LineaOcInput = z.infer<typeof lineaOcSchema>;

// ─── Crear Orden de Compra ─────────────────────────────────────────────────

export const crearOcSchema = z
  .object({
    proveedor_id: z.string().uuid("ID de proveedor inválido"),
    items: z
      .array(lineaOcSchema)
      .min(1, "La OC debe tener al menos 1 ítem")
      .max(300, "Máximo 300 ítems por OC"),
    is_tax_included: z.boolean().optional().default(false),
    remarks: z.string().trim().max(500).optional().default(""),
    warehouse: z.string().trim().max(50).optional().default(""),
  })
  .superRefine((val, ctx) => {
    const subtotal = val.items.reduce(
      (s, it) => s + it.cantidad * it.unit_price,
      0,
    );
    if (subtotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El subtotal de la OC debe ser mayor a 0",
        path: ["items"],
      });
    }
  });
export type CrearOcInput = z.infer<typeof crearOcSchema>;

// ─── Recepción ─────────────────────────────────────────────────────────────

export const registrarRecepcionSchema = z.object({
  oc_id: z.string().uuid("ID de OC inválido"),
  factura_numero: z.string().trim().max(50).optional().default(""),
  factura_fecha: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), {
      message: "Fecha inválida (formato esperado YYYY-MM-DD)",
    })
    .optional()
    .default(() => new Date().toISOString().split("T")[0]),
  factura_monto: z.number().min(0).optional().default(0),
  factura_archivo_url: z.string().url().max(2000).optional(),
  observaciones: z.string().trim().max(500).optional().default(""),
  items: z
    .array(
      z.object({
        oc_item_id: z.string().uuid("ID de ítem inválido"),
        cantidad_recibida: z
          .number()
          .int("Debe ser entero")
          .min(0, "No puede ser negativo"),
        serial: z.string().trim().max(100).optional().default(""),
        observaciones: z.string().trim().max(500).optional().default(""),
        fotos: z
          .array(z.string().url("URL de foto inválida").max(1000))
          .max(10, "Máximo 10 fotos por ítem")
          .optional()
          .default([]),
      }),
    )
    .min(1, "Debe indicarse al menos un ítem"),
});
// z.input: los campos con default quedan opcionales para quienes invocan.
export type RegistrarRecepcionInput = z.input<typeof registrarRecepcionSchema>;

export const ingresarStockSchema = z.object({
  oc_id: z.string().uuid("ID de OC inválido"),
  deposito_id: z.string().uuid("ID de depósito inválido"),
});

// ─── Pagos a proveedores ───────────────────────────────────────────────────

export const registrarPagoProveedorSchema = z.object({
  oc_id: z.string().uuid("ID de OC inválido"),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  metodo_pago: z
    .string()
    .trim()
    .min(1, "Método de pago requerido")
    .max(100, "Máximo 100 caracteres"),
  numero_factura: z.string().trim().max(50).optional().default(""),
  referencia: z.string().trim().max(100).optional().default(""),
});
export type RegistrarPagoProveedorInput = z.infer<typeof registrarPagoProveedorSchema>;

export const anularPagoProveedorSchema = z.object({
  id: z.string().uuid("ID de pago inválido"),
  motivo: z
    .string()
    .trim()
    .min(1, "El motivo es obligatorio")
    .max(500, "Máximo 500 caracteres"),
});

export const cambioEstadoOcSchema = z.object({
  id: z.string().uuid("ID de OC inválido"),
});
