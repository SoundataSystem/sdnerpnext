import { z } from "zod";

export const actualizarConfiguracionSchema = z.object({
  costo_operativo_global: z.coerce
    .number()
    .min(0, "No puede ser negativo")
    .max(100, "Máximo 100%")
    .optional(),
  porcentaje_comision_vendedor: z.coerce
    .number()
    .min(0, "No puede ser negativo")
    .max(100, "Máximo 100%")
    .optional(),
  tipo_cambio_usd: z.coerce
    .number()
    .min(0.0001, "Debe ser mayor a cero")
    .optional(),
  texto_base_certificado: z.string().trim().max(2000).optional().default(""),
  condiciones_generales: z.string().trim().max(4000).optional().default(""),
  membrete_texto: z.string().trim().max(2000).optional().default(""),
  logo_url: z.string().trim().max(500).optional().default(""),
  email_contacto: z.string().trim().max(200).optional().default(""),
  telefono_contacto: z.string().trim().max(100).optional().default(""),
});
export type ActualizarConfiguracionInput = z.infer<
  typeof actualizarConfiguracionSchema
>;

// ─── Métodos de pago ────────────────────────────────────────────────────────

export const crearMetodoPagoSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
  porcentaje_costo: z
    .number()
    .min(0, "No puede ser negativo")
    .max(100, "Máximo 100%")
    .default(0),
  activo: z.boolean().optional().default(true),
});
export type CrearMetodoPagoInput = z.infer<typeof crearMetodoPagoSchema>;

export const actualizarMetodoPagoSchema = crearMetodoPagoSchema.partial();
export type ActualizarMetodoPagoInput = z.infer<
  typeof actualizarMetodoPagoSchema
>;

export const eliminarMetodoPagoSchema = z.object({
  id: z.string().uuid("ID de método de pago inválido"),
});
