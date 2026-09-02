-- FASE 20 (P4): índices de rendimiento por columnas de filtro/ordenamiento.
-- DDL no destructivo: solo CREATE INDEX. Nombre = convención Prisma <tabla>_<columna>_idx.

-- Ordenes
CREATE INDEX IF NOT EXISTS "ordenes_cliente_id_idx" ON "ordenes" ("cliente_id");
CREATE INDEX IF NOT EXISTS "ordenes_vendedor_id_idx" ON "ordenes" ("vendedor_id");
CREATE INDEX IF NOT EXISTS "ordenes_estado_idx" ON "ordenes" ("estado");
CREATE INDEX IF NOT EXISTS "ordenes_estado_caja_idx" ON "ordenes" ("estado_caja");
CREATE INDEX IF NOT EXISTS "ordenes_created_at_idx" ON "ordenes" ("created_at");

-- OrdenProducto (kardex por producto)
CREATE INDEX IF NOT EXISTS "orden_productos_producto_id_idx" ON "orden_productos" ("producto_id");

-- CajaMovimiento
CREATE INDEX IF NOT EXISTS "caja_movimientos_estado_idx" ON "caja_movimientos" ("estado");
CREATE INDEX IF NOT EXISTS "caja_movimientos_cliente_id_idx" ON "caja_movimientos" ("cliente_id");
CREATE INDEX IF NOT EXISTS "caja_movimientos_fecha_cobro_idx" ON "caja_movimientos" ("fecha_cobro");
CREATE INDEX IF NOT EXISTS "caja_movimientos_created_at_idx" ON "caja_movimientos" ("created_at");

-- Cuentas por Cobrar
CREATE INDEX IF NOT EXISTS "cuentas_cobrar_cliente_id_idx" ON "cuentas_cobrar" ("cliente_id");
CREATE INDEX IF NOT EXISTS "cuentas_cobrar_estado_idx" ON "cuentas_cobrar" ("estado");
CREATE INDEX IF NOT EXISTS "cuentas_cobrar_fecha_vencimiento_idx" ON "cuentas_cobrar" ("fecha_vencimiento");

-- Cuentas por Pagar
CREATE INDEX IF NOT EXISTS "cuentas_pagar_proveedor_id_idx" ON "cuentas_pagar" ("proveedor_id");
CREATE INDEX IF NOT EXISTS "cuentas_pagar_estado_idx" ON "cuentas_pagar" ("estado");
CREATE INDEX IF NOT EXISTS "cuentas_pagar_fecha_vencimiento_idx" ON "cuentas_pagar" ("fecha_vencimiento");

-- Ordenes de compra
CREATE INDEX IF NOT EXISTS "ordenes_compra_proveedor_id_idx" ON "ordenes_compra" ("proveedor_id");
CREATE INDEX IF NOT EXISTS "ordenes_compra_estado_idx" ON "ordenes_compra" ("estado");
CREATE INDEX IF NOT EXISTS "ordenes_compra_created_at_idx" ON "ordenes_compra" ("created_at");

-- Recepciones de compra
CREATE INDEX IF NOT EXISTS "recepciones_compra_orden_compra_id_idx" ON "recepciones_compra" ("orden_compra_id");
CREATE INDEX IF NOT EXISTS "recepciones_compra_estado_idx" ON "recepciones_compra" ("estado");

-- Movimientos de inventario (kardex por producto)
CREATE INDEX IF NOT EXISTS "movimientos_inventario_producto_id_idx" ON "movimientos_inventario" ("producto_id");
CREATE INDEX IF NOT EXISTS "movimientos_inventario_tipo_idx" ON "movimientos_inventario" ("tipo");
CREATE INDEX IF NOT EXISTS "movimientos_inventario_created_at_idx" ON "movimientos_inventario" ("created_at");

-- Ajustes de stock
CREATE INDEX IF NOT EXISTS "ajustes_stock_deposito_id_idx" ON "ajustes_stock" ("deposito_id");
CREATE INDEX IF NOT EXISTS "ajustes_stock_estado_idx" ON "ajustes_stock" ("estado");

-- Ordenes de servicio
CREATE INDEX IF NOT EXISTS "ordenes_servicio_cliente_id_idx" ON "ordenes_servicio" ("cliente_id");
CREATE INDEX IF NOT EXISTS "ordenes_servicio_estado_idx" ON "ordenes_servicio" ("estado");
CREATE INDEX IF NOT EXISTS "ordenes_servicio_tecnico_asignado_idx" ON "ordenes_servicio" ("tecnico_asignado");

-- Notificaciones ("mis notificaciones no leídas")
CREATE INDEX IF NOT EXISTS "notificaciones_usuario_id_leida_idx" ON "notificaciones" ("usuario_id", "leida");
CREATE INDEX IF NOT EXISTS "notificaciones_created_at_idx" ON "notificaciones" ("created_at");

-- Auditoría (actividad_log)
CREATE INDEX IF NOT EXISTS "actividad_log_usuario_id_idx" ON "actividad_log" ("usuario_id");
CREATE INDEX IF NOT EXISTS "actividad_log_entidad_entidad_id_idx" ON "actividad_log" ("entidad", "entidad_id");
CREATE INDEX IF NOT EXISTS "actividad_log_created_at_idx" ON "actividad_log" ("created_at");

-- Productos
CREATE INDEX IF NOT EXISTS "productos_activo_idx" ON "productos" ("activo");
CREATE INDEX IF NOT EXISTS "productos_nombre_idx" ON "productos" ("nombre");
CREATE INDEX IF NOT EXISTS "productos_cate_idx" ON "productos" ("cate");