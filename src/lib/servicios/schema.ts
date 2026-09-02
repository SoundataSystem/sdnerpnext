import { z } from "zod";

export const estadoOrdenServicioEnum = z.enum([
  "pendiente",
  "en_progreso",
  "completado",
  "cancelado",
  "facturado",
]);
export type EstadoOrdenServicio = z.infer<typeof estadoOrdenServicioEnum>;

export const tipoServicioEnum = z.enum([
  "instalacion",
  "reparacion",
  "mantenimiento",
  "garantia",
  "otro",
]);
export type TipoServicio = z.infer<typeof tipoServicioEnum>;

export const prioridadEnum = z.enum(["baja", "normal", "alta", "urgente"]);
export type Prioridad = z.infer<typeof prioridadEnum>;

export const estadoInstalacionEnum = z.enum([
  "programada",
  "en_curso",
  "completada",
  "cancelada",
]);

export const estadoGarantiaEnum = z.enum([
  "emitida",
  "pendiente",
  "pendiente_validacion",
  "validada",
  "activa",
  "vencida",
  "rechazada",
]);

export const estadoTicketEnum = z.enum([
  "pendiente",
  "en_curso",
  "resuelto",
  "cerrado",
  "cancelado",
]);

export const tipoRmaEnum = z.enum([
  "garantia",
  "producto_defectuoso",
  "producto_incorrecto",
  "danio_transporte",
  "error_venta",
  "cambio_comercial",
  "devolucion_cliente",
  "reparacion",
  "otro",
]);
export type TipoRma = z.infer<typeof tipoRmaEnum>;

export const estadoRmaEnum = z.enum([
  "pendiente",
  "recibido",
  "en_diagnostico",
  "diagnosticado",
  "resuelto",
  "cerrado",
  "rechazado",
  "cancelado",
]);

export const resultadoDiagnosticoRmaEnum = z.enum([
  "falla_confirmada",
  "falla_no_reproducible",
  "danio_fisico",
  "mal_uso",
  "producto_incompleto",
  "fuera_garantia",
  "garantia_valida",
  "garantia_rechazada",
  "sin_falla",
]);

export const resolucionRmaEnum = z.enum([
  "reparar",
  "reemplazar_mismo",
  "reemplazar_diferente",
  "devolver_dinero",
  "nota_credito",
  "cambiar_producto",
  "devolver_proveedor",
  "rechazar_garantia",
  "devolver_sin_reparacion",
  "otro",
]);

// ─── Técnicos ───────────────────────────────────────────────────────────────

export const crearTecnicoSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa el nombre").max(120),
  telefono: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().email("Email inválido").optional().default(""),
  especialidad: z.string().trim().max(120).optional().default(""),
});
export type CrearTecnicoInput = z.infer<typeof crearTecnicoSchema>;

export const actualizarTecnicoSchema = crearTecnicoSchema.partial();
export type ActualizarTecnicoInput = z.infer<typeof actualizarTecnicoSchema>;

export const cambiarEstadoTecnicoSchema = z.object({
  id: z.string().uuid("ID de técnico inválido"),
});

// ─── Órdenes de servicio ────────────────────────────────────────────────────

export const crearOrdenServicioSchema = z
  .object({
    cliente_id: z.string().uuid("ID de cliente inválido"),
    producto_id: z.string().uuid("ID de producto inválido").optional().default(""),
    tipo_servicio: tipoServicioEnum,
    descripcion: z.string().trim().min(3, "Describe el trabajo").max(1000),
    prioridad: prioridadEnum.default("normal"),
    fecha_prometida: z
      .string()
      .refine((v) => v === "" || !isNaN(Date.parse(v)), {
        message: "Fecha inválida",
      })
      .optional()
      .default(""),
    costo_servicio: z.number().min(0).default(0),
    costo_repuestos: z.number().min(0).default(0),
    tecnico_asignado: z.string().uuid("ID de técnico inválido").optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.costo_servicio + val.costo_repuestos < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los costos no pueden ser negativos",
        path: ["costo_servicio"],
      });
    }
  });
export type CrearOrdenServicioInput = z.infer<typeof crearOrdenServicioSchema>;

export const cambiarEstadoOrdenServicioSchema = z.object({
  id: z.string().uuid("ID inválido"),
  estado: estadoOrdenServicioEnum,
});

export const asignarTecnicoSchema = z.object({
  id: z.string().uuid("ID inválido"),
  tecnico_id: z.string().uuid("ID de técnico inválido"),
});

// ─── Instalaciones ──────────────────────────────────────────────────────────

export const crearInstalacionSchema = z.object({
  orden_servicio_id: z.string().uuid().optional().default(""),
  tecnico_id: z.string().uuid("ID de técnico inválido").optional().default(""),
  fecha_programada: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Fecha inválida" }),
  hora_inicio: z.string().optional().default(""),
  hora_fin: z.string().optional().default(""),
  direccion_instalacion: z.string().trim().max(300).optional().default(""),
  ciudad: z.string().trim().max(120).optional().default(""),
  notas: z.string().trim().max(500).optional().default(""),
});
export type CrearInstalacionInput = z.infer<typeof crearInstalacionSchema>;

export const cambiarEstadoInstalacionSchema = z.object({
  id: z.string().uuid("ID inválido"),
  estado: estadoInstalacionEnum,
});

// ─── Garantías ──────────────────────────────────────────────────────────────

export const registrarGarantiaSchema = z.object({
  orden_id: z.string().uuid("ID de orden inválido"),
  orden_producto_id: z.string().uuid("ID de ítem de orden inválido"),
  producto_id: z.string().uuid("ID de producto inválido"),
  serial_producto: z.string().trim().min(1, "Ingresa el serial").max(80),
  numero_factura: z.string().trim().max(60).optional().default(""),
  fecha_vencimiento: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Fecha inválida" }),
  condiciones_especificas: z.string().trim().max(500).optional().default(""),
});
export type RegistrarGarantiaInput = z.infer<typeof registrarGarantiaSchema>;

export const validarGarantiaSchema = z.object({
  id: z.string().uuid("ID inválido"),
  valida: z.boolean(),
});

// ─── Tickets de soporte ─────────────────────────────────────────────────────

export const crearTicketSchema = z.object({
  cliente_id: z.string().uuid("ID de cliente inválido"),
  asunto: z.string().trim().min(3, "Ingresa el asunto").max(200),
  descripcion: z.string().trim().min(3, "Describe el problema").max(1000),
  prioridad: prioridadEnum.default("normal"),
});
export type CrearTicketInput = z.infer<typeof crearTicketSchema>;

export const cambiarEstadoTicketSchema = z.object({
  id: z.string().uuid("ID inválido"),
  estado: estadoTicketEnum,
});

// ─── RMA ────────────────────────────────────────────────────────────────────

export const crearRmaSchema = z.object({
  cliente_id: z.string().uuid("ID de cliente inválido"),
  producto_id: z.string().uuid("ID de producto inválido"),
  serial_producto: z.string().trim().max(80).optional().default(""),
  tipo_rma: tipoRmaEnum,
  motivo: z.string().trim().min(3, "Indica el motivo").max(1000),
  prioridad: prioridadEnum.default("normal"),
  orden_id: z.string().uuid().optional().default(""),
  devolucion_venta_id: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  garantia_id: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  orden_servicio_id: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  deposito_recepcion_id: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
});
export type CrearRmaInput = z.infer<typeof crearRmaSchema>;

export const avanzarRmaSchema = z.object({
  id: z.string().uuid("ID inválido"),
  accion: z.enum([
    "recibir",
    "iniciar_diagnostico",
    "diagnosticar",
    "resolver",
    "cerrar",
    "rechazar",
    "cancelar",
  ]),
  diagnostico: z.string().trim().max(1000).optional().default(""),
  resultado_diagnostico: resultadoDiagnosticoRmaEnum.optional(),
  resolucion: resolucionRmaEnum.optional(),
  producto_reemplazo_id: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  monto_reembolso: z.number().min(0).optional().default(0),
  observaciones: z.string().trim().max(1000).optional().default(""),
});
export type AvanzarRmaInput = z.infer<typeof avanzarRmaSchema>;