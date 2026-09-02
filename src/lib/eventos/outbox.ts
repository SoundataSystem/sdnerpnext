import "server-only";
import { Prisma } from "@/generated/prisma/client";

/**
 * Tipo de evento de dominio para el outbox.
 * Se usa para registrar eventos de negocio dentro de la misma transacción.
 */
export interface EventoOutboxInput {
  /** Tipo de evento (ej: "venta.creada", "cobro.registrado", "stock.ajustado") */
  tipo: string;
  /** Correlation ID para tracing distribuido */
  correlationId: string;
  /** Actor que originó el evento */
  actorId?: string;
  actorNombre?: string;
  actorRol?: string;
  /** Entidad afectada */
  entidad: string;
  entidadId: string;
  /** Datos antes/después del cambio */
  datosAnteriores?: Prisma.InputJsonValue;
  datosNuevos?: Prisma.InputJsonValue;
  /** Metadata adicional */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Registra un evento de dominio en el outbox dentro de la transacción actual.
 * Debe llamarse DENTRO de una transacción Prisma existente (tx).
 */
export async function registrarEventoOutbox(
  tx: import("@/generated/prisma/client").Prisma.TransactionClient,
  input: EventoOutboxInput,
): Promise<void> {
  await tx.eventoOutbox.create({
    data: {
      tipo: input.tipo,
      correlation_id: input.correlationId,
      actor_id: input.actorId ?? null,
      actor_nombre: input.actorNombre ?? null,
      actor_rol: input.actorRol ?? null,
      entidad: input.entidad,
      entidad_id: input.entidadId,
      datos_anteriores: input.datosAnteriores ?? undefined,
      datos_nuevos: input.datosNuevos ?? undefined,
      metadata: {
        timestamp: new Date().toISOString(),
        ...(input.metadata as Record<string, unknown>),
      },
    },
  });
}

/**
 * Genera un correlation ID único para tracing distribuido.
 */
export function generarCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Tipos de evento de dominio estándar.
 * Usar estos nombres consistentes para facilitar el procesamiento del outbox.
 */
export const TIPOS_EVENTO = {
  // Ventas
  VENTA_CREADA: "venta.creada",
  VENTA_ACTUALIZADA: "venta.actualizada",
  VENTA_ANULADA: "venta.anulada",
  VENTA_COMPLETADA: "venta.completada",

  // Cotizaciones
  COTIZACION_CREADA: "cotizacion.creada",
  COTIZACION_ACTUALIZADA: "cotizacion.actualizada",
  COTIZACION_APROBADA: "cotizacion.aprobada",
  COTIZACION_RECHAZADA: "cotizacion.rechazada",
  COTIZACION_ANULADA: "cotizacion.anulada",

  // Caja / Cobros
  COBRO_REGISTRADO: "cobro.registrado",
  COBRO_ANULADO: "cobro.anulado",
  COBRO_FACTURADO: "cobro.facturado",
  MOVIMIENTO_CAJA_CREADO: "movimiento_caja.creado",

  // Stock / Inventario
  STOCK_AJUSTADO: "stock.ajustado",
  STOCK_INCREMENTADO: "stock.incrementado",
  STOCK_DECREMENTADO: "stock.decrementado",
  STOCK_TRANSFERIDO: "stock.transferido",
  PRODUCTO_CREADO: "producto.creado",
  PRODUCTO_ACTUALIZADO: "producto.actualizado",

  // Compras
  COMPRA_CREADA: "compra.creada",
  COMPRA_APROBADA: "compra.aprobada",
  COMPRA_RECIBIDA: "compra.recibida",
  RECEPCION_CREADA: "recepcion.creada",

  // Devoluciones
  DEVOLUCION_VENTA_CREADA: "devolucion_venta.creada",
  DEVOLUCION_VENTA_APROBADA: "devolucion_venta.aprobada",
  DEVOLUCION_COMPRA_CREADA: "devolucion_compra.creada",
  DEVOLUCION_COMPRA_APROBADA: "devolucion_compra.aprobada",

  // Ajustes
  AJUSTE_CREADO: "ajuste.creado",
  AJUSTE_APROBADO: "ajuste.aprobado",

  // Transferencias
  TRANSFERENCIA_CREADA: "transferencia.creada",
  TRANSFERENCIA_APROBADA: "transferencia.aprobada",

  // Clientes / Proveedores
  CLIENTE_CREADO: "cliente.creado",
  CLIENTE_ACTUALIZADO: "cliente.actualizado",
  PROVEEDOR_CREADO: "proveedor.creado",
  PROVEEDOR_ACTUALIZADO: "proveedor.actualizado",

  // Usuarios / Configuración
  USUARIO_CREADO: "usuario.creado",
  USUARIO_ACTUALIZADO: "usuario.actualizado",
  CONFIGURACION_ACTUALIZADA: "configuracion.actualizada",
} as const;