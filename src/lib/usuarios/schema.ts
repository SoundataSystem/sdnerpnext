import { z } from "zod";

export const rolUsuarioEnum = z.enum([
  "admin",
  "vendedor",
  "servicio_tecnico",
  "supervisor_tecnico",
  "logistica",
  "chofer",
  "nominal",
  "cajero",
  "deposito",
  "contabilidad",
  "compra",
  "administracion",
]);
export type RolUsuario = z.infer<typeof rolUsuarioEnum>;

export const crearUsuarioSchema = z.object({
  email: z.string().trim().email("Email inválido").toLowerCase(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
  apellido: z.string().trim().min(1, "Apellido requerido").max(100),
  rol: rolUsuarioEnum,
  telefono: z.string().trim().max(50).optional().default(""),
  vendedor_codigo: z.string().trim().max(20).optional().default(""),
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z.object({
  email: z.string().trim().email("Email inválido").toLowerCase().optional(),
  password: z.string().min(8, "Mínimo 8 caracteres").optional(),
  nombre: z.string().trim().min(1).max(100).optional(),
  apellido: z.string().trim().min(1).max(100).optional(),
  rol: rolUsuarioEnum.optional(),
  telefono: z.string().trim().max(50).optional(),
  vendedor_codigo: z.string().trim().max(20).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;

export const vincularUsuarioSchema = z.object({
  usuario_id: z.string().uuid("ID de usuario inválido"),
  auth_user_id: z
    .string()
    .trim()
    .min(1, "ID de usuario de Supabase requerido"),
});
export type VincularUsuarioInput = z.infer<typeof vincularUsuarioSchema>;
