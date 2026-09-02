import { z } from "zod";

export const tipoAjusteEnum = z.enum([
  "inventario",
  "rotura",
  "vencimiento",
  "ajuste",
  "robo",
]);
export type TipoAjuste = z.infer<typeof tipoAjusteEnum>;

export const tipoMovimientoEnum = z.enum([
  "entrada",
  "salida",
  "ajuste",
  "transferencia",
  "devolucion",
]);
export type TipoMovimiento = z.infer<typeof tipoMovimientoEnum>;

// ─── Productos ─────────────────────────────────────────────────────────────

export const crearProductoSchema = z.object({
  codigo: z.string().trim().max(50).optional().default(""),
  nombre: z.string().trim().min(1, "Nombre del producto requerido").max(200),
  descripcion: z.string().trim().max(500).optional().default(""),
  barcode: z.string().trim().max(100).optional().default(""),
  cate: z.string().trim().max(100).optional().default(""),
  subcate: z.string().trim().max(100).optional().default(""),
  precio_base: z.number().min(0, "El precio no puede ser negativo"),
  purchase_cost: z.number().min(0, "El costo no puede ser negativo"),
  stock_minimo: z.number().int().min(0).optional().default(3),
  stock_maximo: z.number().int().min(0).optional().default(100),
  activo: z.boolean().optional().default(true),
});
export type CrearProductoInput = z.infer<typeof crearProductoSchema>;

export const actualizarProductoSchema = crearProductoSchema.partial();
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;

// ─── Depósitos ─────────────────────────────────────────────────────────────

export const crearDepositoSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre del depósito requerido").max(100),
  columna_stock: z
    .string()
    .trim()
    .min(1, "Columna de stock requerida")
    .max(100),
  activo: z.boolean().optional().default(true),
});
export type CrearDepositoInput = z.infer<typeof crearDepositoSchema>;

export const actualizarDepositoSchema = crearDepositoSchema.partial();
export type ActualizarDepositoInput = z.infer<typeof actualizarDepositoSchema>;

// ─── Línea de ajuste ───────────────────────────────────────────────────────

export const lineaAjusteSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  stock_actual: z.number().int().min(0).optional().default(0),
  stock_nuevo: z.number().int().min(0, "El stock nuevo no puede ser negativo"),
});
export type LineaAjusteInput = z.infer<typeof lineaAjusteSchema>;export const crearAjusteStockSchema = z.object({
  deposito_id: z.string().uuid("ID de depósito inválido"),
  tipo: tipoAjusteEnum.default("inventario"),
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(500),
  fecha: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), {
      message: "Fecha inválida (formato esperado YYYY-MM-DD)",
    })
    .optional()
    .default(() => new Date().toISOString().split("T")[0]),
  items: z
    .array(lineaAjusteSchema)
    .min(1, "El ajuste debe tener al menos 1 ítem")
    .max(300, "Máximo 300 ítems por ajuste"),
});
export type CrearAjusteStockInput = z.infer<typeof crearAjusteStockSchema>;

// ─── Transferencias entre depósitos ────────────────────────────────────────

export const lineaTransferenciaSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z.number().int().min(1, "La cantidad debe ser mayor a 0"),
  seriales: z
    .array(z.string().uuid("ID de serie inválido"))
    .optional()
    .default([]),
});
export type LineaTransferenciaInput = z.infer<typeof lineaTransferenciaSchema>;

export const crearTransferenciaSchema = z
  .object({
    deposito_origen_id: z.string().uuid("ID de depósito origen inválido"),
    deposito_destino_id: z.string().uuid("ID de depósito destino inválido"),
    motivo: z.string().trim().max(500).optional().default(""),
    items: z
      .array(lineaTransferenciaSchema)
      .min(1, "La transferencia debe tener al menos 1 ítem")
      .max(300, "Máximo 300 ítems por transferencia"),
  })
  .superRefine((val, ctx) => {
    if (val.deposito_origen_id === val.deposito_destino_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deposito_destino_id"],
        message: "El depósito destino debe ser distinto del origen",
      });
    }
  });
export type CrearTransferenciaInput = z.infer<typeof crearTransferenciaSchema>;

export const aprobarAjusteSchema = z.object({
  id: z.string().uuid("ID de ajuste inválido"),
});

export const rechazarAjusteSchema = z.object({
  id: z.string().uuid("ID de ajuste inválido"),
  motivo: z.string().trim().max(500).optional().default(""),
});

export const cambiarEstadoProductoSchema = z.object({
  id: z.string().uuid("ID de producto inválido"),
  activo: z.boolean(),
});

// Filtro de movimientos
export const filtroMovimientosSchema = z.object({
  tipo: z.string().optional(),
  busqueda: z.string().optional(),
});