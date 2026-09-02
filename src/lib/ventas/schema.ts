import { z } from "zod";

export const estadoOrdenEnum = z.enum([
  "pendiente",
  "completada",
  "cancelada",
]);
export type EstadoOrden = z.infer<typeof estadoOrdenEnum>;

export const estadoCajaMovimientoEnum = z.enum([
  "pendiente",
  "facturado",
  "cobrado",
  "anulado",
]);
export type EstadoCajaMovimiento = z.infer<typeof estadoCajaMovimientoEnum>;

// ─── Clientes ─────────────────────────────────────────────────────────────

export const crearClienteSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Nombre requerido")
    .max(200, "Máximo 200 caracteres"),
  apellido: z
    .string()
    .trim()
    .min(1, "Apellido requerido")
    .max(200, "Máximo 200 caracteres"),
  cedula: z
    .string()
    .trim()
    .min(1, "Cédula requerida")
    .max(50, "Máximo 50 caracteres"),
  telefono: z
    .string()
    .trim()
    .min(1, "Teléfono requerido")
    .max(50, "Máximo 50 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(200, "Máximo 200 caracteres"),
  direccion: z.string().trim().max(300).optional().default(""),
  ciudad: z.string().trim().max(100).optional().default(""),
  ruc: z.string().trim().max(50).optional().default(""),
  pais: z.string().trim().max(100).optional().default("Paraguay"),
  tipo_documento: z.string().trim().max(10).optional().default("CI"),
});
export type CrearClienteInput = z.infer<typeof crearClienteSchema>;

export const actualizarClienteSchema = crearClienteSchema.partial();
export type ActualizarClienteInput = z.infer<typeof actualizarClienteSchema>;

// ─── Línea de orden ───────────────────────────────────────────────────────

export const lineaOrdenSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0").max(99999),
  precio_unitario: z.number().min(0, "El precio no puede ser negativo"),
  serial: z.string().trim().max(100).optional().default(""),
});
export type LineaOrdenInput = z.infer<typeof lineaOrdenSchema>;

export const tipoVentaEnum = z.enum([
  "contado",
  "credito",
  "web",
  "mayor",
  "tax_free",
  "iva_incluido",
  "delivery",
]);
export type TipoVenta = z.infer<typeof tipoVentaEnum>;

export const monedaOrdenEnum = z.enum(["GS", "USD"]);

export const SUCURSALES = [
  "ESPAÑA",
  "PALMA",
  "COPACO",
  "EUSEBIO AYALA",
  "JUAN DEL CASTILLO",
  "LOCAL 18",
  "SALON VENTAS",
  "SOUNDATA",
  "SERVICIO TECNICO",
  "REGALOS",
  "RMA",
] as const;
export const SUCURSALES_LIST: string[] = [...SUCURSALES];

// ─── Crear Orden (encabezado + ítems) ────────────────────────────────────

export const crearOrdenSchema = z
  .object({
    cliente_id: z.string().uuid("ID de cliente inválido"),
    vendedor_id: z.string().uuid("ID de vendedor inválido").optional(),
    items: z
      .array(lineaOrdenSchema)
      .min(1, "La orden debe tener al menos 1 ítem")
      .max(200, "Máximo 200 ítems por orden"),
    observaciones: z.string().trim().max(500).optional().default(""),
    is_tax_included: z.boolean().optional().default(false),
    sucursal: z.string().trim().max(100).optional().default(""),
    moneda: monedaOrdenEnum.optional().default("GS"),
    tipo_venta: tipoVentaEnum.optional().default("contado"),
    costo_delivery: z.number().min(0).max(999999999).optional(),
    metodo_pago: z.string().trim().max(100).optional().default(""),
    // Clave de idempotencia del cliente (UUID por intención de submit):
    // doble click / retry / requests simultáneos → exactamente UNA orden.
    clave_idempotencia: z.string().uuid("Clave de idempotencia inválida").optional(),
  })
  .superRefine((val, ctx) => {
    const subtotal = val.items.reduce(
      (s, it) => s + it.cantidad * it.precio_unitario,
      0,
    );
    if (subtotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El subtotal de la orden debe ser mayor a 0",
        path: ["items"],
      });
    }
  });
export type CrearOrdenInput = z.infer<typeof crearOrdenSchema>;

// ─── Actualizar Orden (reemplaza ítems: restaura y vuelve a descontar stock) ──

export const actualizarOrdenSchema = crearOrdenSchema;
export type ActualizarOrdenInput = z.infer<typeof actualizarOrdenSchema>;

export const eliminarOrdenSchema = z.object({
  id: z.string().uuid("ID de orden inválido"),
  motivo: z
    .string()
    .trim()
    .min(1, "El motivo es obligatorio")
    .max(500, "Máximo 500 caracteres"),
});
export type EliminarOrdenInput = z.infer<typeof eliminarOrdenSchema>;

// ─── Caja / Cobros ────────────────────────────────────────────────────────

export const registrarCobroSchema = z.object({
  orden_id: z.string().uuid("ID de orden inválido"),
  monto_pagado: z.number().positive("El monto debe ser mayor a 0"),
  metodo_pago: z
    .string()
    .trim()
    .min(1, "Método de pago requerido")
    .max(100, "Máximo 100 caracteres"),
  numero_factura: z.string().trim().max(50).optional().default(""),
  // Clave de idempotencia generada por el cliente (UUID) UNA vez por intención
  // de submit: protege contra doble click y retries duplicando el pago.
  clave_idempotencia: z.string().uuid("Clave de idempotencia inválida").optional(),
});
export type RegistrarCobroInput = z.infer<typeof registrarCobroSchema>;

export const anularCajaMovimientoSchema = z.object({
  id: z.string().uuid("ID de movimiento inválido"),
  motivo: z
    .string()
    .trim()
    .min(1, "El motivo es obligatorio")
    .max(500, "Máximo 500 caracteres"),
});

export const facturarCajaMovimientoSchema = z.object({
  id: z.string().uuid("ID de movimiento inválido"),
  numero_factura: z
    .string()
    .trim()
    .min(1, "El número de factura es obligatorio")
    .max(50, "Máximo 50 caracteres"),
});
export type FacturarCajaMovimientoInput = z.infer<
  typeof facturarCajaMovimientoSchema
>;

export const cambioEstadoOrdenSchema = z.object({
  id: z.string().uuid("ID de orden inválido"),
});

export const registrarImpresionTicketSchema = z.object({
  id: z.string().uuid("ID de orden inválido"),
  formato: z.enum(["ticket", "factura"]).default("ticket"),
});

// ─── Filtros de listado ───────────────────────────────────────────────────

export const listadoOrdenesFiltroSchema = z.object({
  estado: z.string().optional(),
  busqueda: z.string().optional(),
});
