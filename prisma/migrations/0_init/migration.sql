-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin', 'vendedor', 'servicio_tecnico', 'supervisor_tecnico', 'logistica', 'chofer', 'nominal', 'cajero', 'deposito', 'contabilidad', 'compra', 'administracion', 'recepcion_compras');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('pendiente', 'completada', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoGarantia" AS ENUM ('emitida', 'pendiente', 'pendiente_validacion', 'validada', 'activa', 'vencida', 'rechazada');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "EstadoCajaMovimiento" AS ENUM ('pendiente', 'facturado', 'cobrado', 'anulado');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('pendiente', 'borrador', 'pendiente_aprobacion', 'aprobada', 'enviada', 'recepcion_parcial', 'recepcion_completa', 'pendiente_ingreso_stock', 'ingresada', 'cerrada', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoDevolucion" AS ENUM ('pendiente', 'aprobada', 'rechazada');

-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('pendiente', 'en_curso', 'resuelto', 'cerrado', 'cancelado');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('baja', 'normal', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('entrada', 'salida', 'ajuste', 'transferencia', 'devolucion');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('instalacion', 'reparacion', 'mantenimiento', 'garantia', 'otro');

-- CreateEnum
CREATE TYPE "EstadoOrdenServicio" AS ENUM ('pendiente', 'en_progreso', 'completado', 'cancelado', 'facturado');

-- CreateEnum
CREATE TYPE "EstadoInstalacion" AS ENUM ('programada', 'en_curso', 'completada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto');

-- CreateEnum
CREATE TYPE "EstadoAsiento" AS ENUM ('borrador', 'contabilizado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('pendiente', 'parcial', 'pagado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoImportacionPegasus" AS ENUM ('clientes', 'proveedores', 'productos', 'stock', 'seriales');

-- CreateEnum
CREATE TYPE "EstadoImportacion" AS ENUM ('completada', 'revertida', 'parcial');

-- CreateEnum
CREATE TYPE "TipoAjusteStock" AS ENUM ('inventario', 'rotura', 'vencimiento', 'ajuste', 'robo');

-- CreateEnum
CREATE TYPE "EstadoAjuste" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- CreateEnum
CREATE TYPE "EstadoRecepcion" AS ENUM ('pendiente', 'aprobada', 'rechazada');

-- CreateEnum
CREATE TYPE "EstadoItemRecepcion" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- CreateEnum
CREATE TYPE "EstadoIngresoStock" AS ENUM ('pendiente', 'completado');

-- CreateEnum
CREATE TYPE "TipoRma" AS ENUM ('garantia', 'producto_defectuoso', 'producto_incorrecto', 'danio_transporte', 'error_venta', 'cambio_comercial', 'devolucion_cliente', 'reparacion', 'otro');

-- CreateEnum
CREATE TYPE "EstadoRma" AS ENUM ('pendiente', 'recibido', 'en_diagnostico', 'diagnosticado', 'resuelto', 'cerrado', 'rechazado', 'cancelado');

-- CreateEnum
CREATE TYPE "ResultadoDiagnosticoRma" AS ENUM ('falla_confirmada', 'falla_no_reproducible', 'danio_fisico', 'mal_uso', 'producto_incompleto', 'fuera_garantia', 'garantia_valida', 'garantia_rechazada', 'sin_falla');

-- CreateEnum
CREATE TYPE "ResolucionRma" AS ENUM ('reparar', 'reemplazar_mismo', 'reemplazar_diferente', 'devolver_dinero', 'nota_credito', 'cambiar_producto', 'devolver_proveedor', 'rechazar_garantia', 'devolver_sin_reparacion', 'otro');

-- CreateEnum
CREATE TYPE "TipoDocumentoRma" AS ENUM ('foto_producto', 'foto_danio', 'factura', 'comprobante', 'informe_tecnico', 'documento_proveedor');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'vendedor',
    "telefono" TEXT,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendedor_codigo" TEXT,
    "auth_user_id" UUID,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_sistema" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "costo_operativo_global" DECIMAL(65,30) DEFAULT 0,
    "porcentaje_comision_vendedor" DECIMAL(65,30) DEFAULT 0,
    "texto_base_certificado" TEXT DEFAULT '',
    "condiciones_generales" TEXT DEFAULT '',
    "logo_url" TEXT,
    "membrete_texto" TEXT DEFAULT '',
    "ultima_modificacion" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "modificado_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_cambio_usd" DECIMAL(65,30) NOT NULL DEFAULT 7500,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "erp_original_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo_pegasus" TEXT,
    "condicion_venta_pegasus" TEXT,
    "codigo_vendedor" TEXT,
    "pais" TEXT DEFAULT 'Paraguay',
    "ruc" TEXT,
    "code" TEXT,
    "client_type" TEXT,
    "discount" DECIMAL(65,30) DEFAULT 0,
    "sales_condition" TEXT,
    "salesperson_code" TEXT,
    "price_type" TEXT,
    "tax_id" TEXT,
    "zone" TEXT,
    "amount" DECIMAL(65,30) DEFAULT 0,
    "tipo_documento" TEXT NOT NULL DEFAULT 'CI',

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio_base" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "activo" BOOLEAN DEFAULT true,
    "erp_original_id" TEXT,
    "almacen1" DECIMAL(65,30) DEFAULT 0,
    "almacen2" DECIMAL(65,30) DEFAULT 0,
    "almacen3" DECIMAL(65,30) DEFAULT 0,
    "almacen4" DECIMAL(65,30) DEFAULT 0,
    "almacen5" DECIMAL(65,30) DEFAULT 0,
    "almacen6" DECIMAL(65,30) DEFAULT 0,
    "almacen7" DECIMAL(65,30) DEFAULT 0,
    "almacen8" DECIMAL(65,30) DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stock_copaco" DECIMAL(65,30) DEFAULT 0,
    "stock_espana" DECIMAL(65,30) DEFAULT 0,
    "stock_eusebio_ayala" DECIMAL(65,30) DEFAULT 0,
    "stock_faltantes" DECIMAL(65,30) DEFAULT 0,
    "stock_faltantes_espana" DECIMAL(65,30) DEFAULT 0,
    "stock_juan_del_castillo" DECIMAL(65,30) DEFAULT 0,
    "stock_local_18" DECIMAL(65,30) DEFAULT 0,
    "stock_obsoletos" DECIMAL(65,30) DEFAULT 0,
    "stock_regalos" DECIMAL(65,30) DEFAULT 0,
    "stock_rma" DECIMAL(65,30) DEFAULT 0,
    "stock_servicio_tec_vans" DECIMAL(65,30) DEFAULT 0,
    "stock_servicio_tecnico" DECIMAL(65,30) DEFAULT 0,
    "stock_salon_espana" DECIMAL(65,30) DEFAULT 0,
    "stock_salon_ventas" DECIMAL(65,30) DEFAULT 0,
    "stock_soundata" DECIMAL(65,30) DEFAULT 0,
    "stock_subsuelo" DECIMAL(65,30) DEFAULT 0,
    "stock_uso_interno_espana" DECIMAL(65,30) DEFAULT 0,
    "stock_vidriera_a3c" DECIMAL(65,30) DEFAULT 0,
    "stock_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(65,30) DEFAULT 3,
    "stock_maximo" DECIMAL(65,30) DEFAULT 100,
    "no" TEXT,
    "cate" TEXT,
    "subcate" TEXT,
    "barcode" TEXT,
    "purchase_cost" DECIMAL(65,30) DEFAULT 0,
    "observaciones_eliminacion" TEXT,
    "codigo_pegasus" TEXT,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "numero_orden" TEXT NOT NULL,
    "vendedor_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "subtotal" DECIMAL(65,30) DEFAULT 0,
    "costo_operativo" DECIMAL(65,30) DEFAULT 0,
    "total" DECIMAL(65,30) DEFAULT 0,
    "comision_vendedor" DECIMAL(65,30) DEFAULT 0,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "erp_original_id" TEXT,
    "is_tax_included" BOOLEAN DEFAULT false,
    "currency1" DECIMAL(65,30) DEFAULT 0,
    "currency4" DECIMAL(65,30) DEFAULT 0,
    "shipping_fee" DECIMAL(65,30) DEFAULT 0,
    "insurance_fee" DECIMAL(65,30) DEFAULT 0,
    "customs_duty" DECIMAL(65,30) DEFAULT 0,
    "other_fees" DECIMAL(65,30) DEFAULT 0,
    "pay_date" DATE,
    "pay_status" TEXT DEFAULT 'pendiente',
    "terms" TEXT,
    "remarks" TEXT,
    "delivery_no" TEXT,
    "estado_caja" TEXT DEFAULT 'pendiente_envio',
    "fecha_envio_caja" TIMESTAMPTZ(6),
    "fecha_cobro" TIMESTAMPTZ(6),
    "numero_factura" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendedor_codigo" TEXT,
    "vendedor_nombre" TEXT,
    "sucursal" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'GS',
    "tipo_cambio" DECIMAL(65,30) NOT NULL DEFAULT 1,

    CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_productos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "orden_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) DEFAULT 0,
    "serial_producto" TEXT,
    "erp_original_id" TEXT,
    "warehouse" INTEGER DEFAULT 1,
    "return_id" UUID,
    "status" TEXT DEFAULT 'sold',
    "serial" TEXT,
    "imei" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garantias" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "codigo_garantia" TEXT NOT NULL,
    "orden_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "orden_producto_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "vendedor_id" UUID NOT NULL,
    "serial_producto" TEXT NOT NULL,
    "estado" "EstadoGarantia" NOT NULL DEFAULT 'emitida',
    "numero_factura" TEXT,
    "fecha_emision" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_validacion" TIMESTAMPTZ(6),
    "fecha_vencimiento" TIMESTAMP NOT NULL,
    "condiciones_especificas" TEXT,
    "validado_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garantias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tabla_afectada" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "usuario_id" UUID,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_movimientos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "orden_id" UUID,
    "orden_numero" TEXT,
    "cliente_id" UUID,
    "monto_total" DECIMAL(65,30),
    "monto_pagado" DECIMAL(65,30),
    "moneda" TEXT,
    "tipo_pago" TEXT,
    "estado" "EstadoCajaMovimiento",
    "fecha_orden" DATE,
    "fecha_cobro" TIMESTAMPTZ(6),
    "vendedor_nombre" TEXT,
    "observaciones" TEXT,
    "creado_por" UUID,
    "numero_factura" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erp_original_id" TEXT,

    CONSTRAINT "caja_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "supplier" TEXT,
    "tax" TEXT,
    "phone" TEXT,
    "document_type" TEXT,
    "condition_description" TEXT,
    "term" TEXT,
    "address" TEXT,
    "create_date" DATE,
    "erp_original_id" TEXT,
    "codigo_pegasus" TEXT,
    "tipo_documento_pegasus" TEXT,
    "plazo_pago" TEXT,
    "fecha_vencimiento_autorizacion" DATE,
    "tiene_acuerdo_comercial" BOOLEAN DEFAULT false,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "po_id" TEXT,
    "is_tax_included" BOOLEAN,
    "warehouse" TEXT,
    "supplier_order_number" TEXT,
    "supplier_id" UUID,
    "receipt_date" DATE,
    "pay_date" DATE,
    "remarks" TEXT,
    "currency1" DECIMAL(65,30) DEFAULT 0,
    "currency2" DECIMAL(65,30) DEFAULT 0,
    "currency3" DECIMAL(65,30) DEFAULT 0,
    "currency4" DECIMAL(65,30) DEFAULT 0,
    "shipping_fee" DECIMAL(65,30) DEFAULT 0,
    "insurance_fee" DECIMAL(65,30) DEFAULT 0,
    "customs_duty" DECIMAL(65,30) DEFAULT 0,
    "other_fees" DECIMAL(65,30) DEFAULT 0,
    "total_fees" DECIMAL(65,30) DEFAULT 0,
    "receipt" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator" UUID,
    "modifier" UUID,
    "erp_original_id" TEXT,
    "numero_orden" TEXT,
    "proveedor_id" UUID,
    "fecha_emision" DATE,
    "fecha_entrega" DATE,
    "subtotal" DECIMAL(65,30) DEFAULT 0,
    "impuestos" DECIMAL(65,30) DEFAULT 0,
    "costo_operativo" DECIMAL(65,30) DEFAULT 0,
    "porcentaje_costo_operativo" DECIMAL(65,30) DEFAULT 0,
    "total" DECIMAL(65,30) DEFAULT 0,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'pendiente',
    "enviada_at" TIMESTAMPTZ(6),
    "aprobada_por" UUID,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra_items" (
    "item_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "po_id" UUID,
    "warehouse" TEXT,
    "product_barcode" TEXT,
    "quantity" DECIMAL(65,30),
    "unit_price" DECIMAL(65,30),
    "currency" TEXT,
    "serial" TEXT,
    "imei" TEXT,
    "status" TEXT,
    "return_id" UUID,
    "erp_original_id" TEXT,
    "producto_id" UUID,
    "cantidad_recibida" DECIMAL(65,30) DEFAULT 0,

    CONSTRAINT "ordenes_compra_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "quotation_id" TEXT,
    "is_tax_included" BOOLEAN,
    "quotation_no" TEXT,
    "customer_id" UUID,
    "quote_date" DATE,
    "valid_until" DATE,
    "status" TEXT,
    "terms" TEXT,
    "currency1" DECIMAL(65,30) DEFAULT 0,
    "currency2" DECIMAL(65,30) DEFAULT 0,
    "currency3" DECIMAL(65,30) DEFAULT 0,
    "currency4" DECIMAL(65,30) DEFAULT 0,
    "shipping_fee" DECIMAL(65,30) DEFAULT 0,
    "insurance_fee" DECIMAL(65,30) DEFAULT 0,
    "customs_duty" DECIMAL(65,30) DEFAULT 0,
    "other_fees" DECIMAL(65,30) DEFAULT 0,
    "creator" UUID,
    "modifier" UUID,
    "erp_original_id" TEXT,
    "numero_cotizacion" TEXT,
    "cliente_id" UUID,
    "vendedor_id" UUID,
    "fecha_emision" DATE DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE,
    "subtotal" DECIMAL(65,30) DEFAULT 0,
    "descuento" DECIMAL(65,30) DEFAULT 0,
    "total" DECIMAL(65,30) DEFAULT 0,
    "estado" TEXT DEFAULT 'pendiente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones_items" (
    "item_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "quotation_id" UUID,
    "barcode" TEXT,
    "quantity" DECIMAL(65,30),
    "unit_price" DECIMAL(65,30),
    "currency" TEXT,
    "erp_original_id" TEXT,
    "producto_id" UUID,
    "cotizacion_id" UUID,
    "cantidad" DECIMAL(65,30),
    "precio_unitario" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizaciones_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "devoluciones_compra" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "po_id" UUID,
    "supplier_order_number" TEXT,
    "supplier_id" UUID,
    "receipt_date" DATE,
    "pay_date" DATE,
    "remarks" TEXT,
    "currency1" DECIMAL(65,30) DEFAULT 0,
    "currency4" DECIMAL(65,30) DEFAULT 0,
    "shipping_fee" DECIMAL(65,30) DEFAULT 0,
    "insurance_fee" DECIMAL(65,30) DEFAULT 0,
    "customs_duty" DECIMAL(65,30) DEFAULT 0,
    "other_fees" DECIMAL(65,30) DEFAULT 0,
    "total_fees" DECIMAL(65,30) DEFAULT 0,
    "receipt" TEXT,
    "credit_note" TEXT,
    "creator" UUID,
    "modifier" UUID,
    "erp_original_id" TEXT,
    "numero_devolucion" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" "EstadoDevolucion" NOT NULL DEFAULT 'pendiente',
    "orden_compra_id" UUID,
    "proveedor_id" UUID,
    "motivo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_ventas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "delivery_id" UUID,
    "delivery_no" TEXT,
    "customer_id" UUID,
    "receipt_date" DATE,
    "reason" TEXT,
    "remarks" TEXT,
    "shipping_fee" DECIMAL(65,30) DEFAULT 0,
    "insurance_fee" DECIMAL(65,30) DEFAULT 0,
    "customs_duty" DECIMAL(65,30) DEFAULT 0,
    "other_fees" DECIMAL(65,30) DEFAULT 0,
    "currency1" DECIMAL(65,30) DEFAULT 0,
    "currency4" DECIMAL(65,30) DEFAULT 0,
    "credit_note" TEXT,
    "creator" UUID,
    "modifier" UUID,
    "warehouse" TEXT,
    "completion_date" DATE,
    "status" TEXT,
    "erp_original_id" TEXT,
    "procesada_at" TIMESTAMPTZ(6),
    "numero_devolucion" TEXT,
    "orden_id" UUID,
    "cliente_id" UUID,
    "motivo" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" "EstadoDevolucion" NOT NULL DEFAULT 'pendiente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "margenes_ganancia" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "cate" TEXT,
    "subcate" TEXT,
    "profit_margin_rate" DECIMAL(65,30),
    "erp_original_id" TEXT,

    CONSTRAINT "margenes_ganancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_clientes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "payment_id" UUID,
    "client_id" UUID,
    "invoice_number" TEXT,
    "total_amount" DECIMAL(65,30),
    "payment_amount" DECIMAL(65,30),
    "payment_date" DATE,
    "payment_method" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator" UUID,
    "modifier" UUID,
    "erp_original_id" TEXT,
    "orden_id" UUID,
    "cliente_id" UUID,
    "monto" DECIMAL(65,30),
    "fecha_pago" DATE,
    "metodo_pago" TEXT,
    "referencia" TEXT,

    CONSTRAINT "pagos_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_proveedores" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "payment_id" UUID,
    "supplier_id" UUID,
    "invoice_number" TEXT,
    "total_amount" DECIMAL(65,30),
    "payment_amount" DECIMAL(65,30),
    "payment_date" DATE,
    "payment_method" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator" UUID,
    "modifier" UUID,
    "erp_original_id" TEXT,
    "orden_compra_id" UUID,
    "proveedor_id" UUID,
    "monto" DECIMAL(65,30),
    "fecha_pago" DATE,
    "metodo_pago" TEXT,
    "referencia" TEXT,

    CONSTRAINT "pagos_proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets_soporte" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "opendate" DATE,
    "companyname" TEXT,
    "description" TEXT,
    "expectedcompletiondate" DATE,
    "isclosed" BOOLEAN,
    "creator" TEXT,
    "erp_original_id" TEXT,
    "numero_ticket" TEXT,
    "cliente_id" UUID,
    "usuario_id" UUID,
    "asunto" TEXT,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "tickets_soporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre" TEXT NOT NULL,
    "icono" TEXT DEFAULT 'credit-card',
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "porcentaje_costo" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depositos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre" TEXT NOT NULL,
    "columna_stock" TEXT NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "producto_id" UUID NOT NULL,
    "producto_nombre" TEXT,
    "producto_codigo" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stock_anterior" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stock_nuevo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deposito_origen" TEXT,
    "deposito_destino" TEXT,
    "referencia" TEXT,
    "motivo" TEXT,
    "observaciones" TEXT,
    "usuario_nombre" TEXT DEFAULT 'Admin',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_servicio" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "numero_orden" TEXT NOT NULL,
    "cliente_id" UUID NOT NULL,
    "cliente_nombre" TEXT,
    "cliente_telefono" TEXT,
    "producto_id" UUID,
    "producto_nombre" TEXT,
    "producto_codigo" TEXT,
    "tipo_servicio" "TipoServicio" NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoOrdenServicio" NOT NULL DEFAULT 'pendiente',
    "tecnico_asignado" UUID,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'normal',
    "fecha_ingreso" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "fecha_prometida" TIMESTAMP,
    "fecha_completado" TIMESTAMP,
    "costo_servicio" DECIMAL(65,30) DEFAULT 0,
    "costo_repuestos" DECIMAL(65,30) DEFAULT 0,
    "costo_total" DECIMAL(65,30) DEFAULT 0,
    "diagnostico_tecnico" TEXT,
    "observaciones" TEXT,
    "usuario_nombre" TEXT DEFAULT 'Admin',
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tecnicos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "especialidad" TEXT,
    "horario_inicio" TIME DEFAULT '08:00:00'::time without time zone,
    "horario_fin" TIME DEFAULT '17:00:00'::time without time zone,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instalaciones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "orden_servicio_id" UUID,
    "tecnico_id" UUID,
    "fecha_programada" DATE NOT NULL,
    "hora_inicio" TIME,
    "hora_fin" TIME,
    "direccion_instalacion" TEXT,
    "ciudad" TEXT,
    "estado" "EstadoInstalacion" NOT NULL DEFAULT 'programada',
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instalaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_cuentas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "padre_id" UUID,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos_contables" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "numero_asiento" TEXT NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "referencia_tipo" TEXT,
    "referencia_id" UUID,
    "estado" "EstadoAsiento" NOT NULL DEFAULT 'borrador',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos_contables_detalle" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "asiento_id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "debe" DECIMAL(65,30) DEFAULT 0,
    "haber" DECIMAL(65,30) DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asientos_contables_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_cobrar" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "cliente_id" UUID NOT NULL,
    "orden_id" UUID,
    "asiento_id" UUID,
    "monto_total" DECIMAL(65,30) NOT NULL,
    "saldo_pendiente" DECIMAL(65,30) NOT NULL,
    "fecha_emision" DATE DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'pendiente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_cobrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_pagar" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "proveedor_id" UUID NOT NULL,
    "orden_compra_id" UUID,
    "asiento_id" UUID,
    "monto_total" DECIMAL(65,30) NOT NULL,
    "saldo_pendiente" DECIMAL(65,30) NOT NULL,
    "fecha_emision" DATE DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'pendiente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importaciones_pegasus" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tipo" "TipoImportacionPegasus" NOT NULL,
    "archivo_nombre" TEXT NOT NULL,
    "filas_total" INTEGER DEFAULT 0,
    "filas_ok" INTEGER DEFAULT 0,
    "filas_warning" INTEGER DEFAULT 0,
    "filas_error" INTEGER DEFAULT 0,
    "usuario_id" UUID,
    "fecha" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoImportacion" NOT NULL DEFAULT 'completada',
    "log_detalle" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_pegasus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendedores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eliminaciones_ordenes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "numero_orden" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "eliminado_por" UUID,
    "datos_orden" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eliminaciones_ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_series" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "producto_id" UUID NOT NULL,
    "serial" TEXT NOT NULL,
    "deposito" TEXT,
    "fecha_ingreso" DATE,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividad_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuario_id" UUID,
    "usuario_nombre" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "detalle" TEXT,
    "datos_previos" JSONB,
    "datos_nuevos" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_ventas_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "devolucion_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "motivo_item" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_ventas_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_depositos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "producto_id" UUID NOT NULL,
    "deposito_id" UUID NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_stock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_ajuste" TEXT NOT NULL,
    "deposito_id" UUID NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoAjusteStock" NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoAjuste" NOT NULL DEFAULT 'pendiente',
    "usuario_id" UUID,
    "aprobado_por" UUID,
    "aprobado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_stock_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ajuste_id" UUID,
    "producto_id" UUID NOT NULL,
    "stock_actual" INTEGER NOT NULL,
    "stock_nuevo" INTEGER NOT NULL,
    "diferencia" INTEGER,
    "motivo_item" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones_compra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_recepcion" TEXT NOT NULL,
    "orden_compra_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "usuario_recepcion_id" UUID NOT NULL,
    "factura_numero" TEXT,
    "factura_fecha" DATE,
    "factura_monto" DECIMAL(65,30),
    "factura_archivo_url" TEXT,
    "estado" "EstadoRecepcion" NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "aprobado_por" UUID,
    "aprobado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepciones_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones_compra_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recepcion_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad_solicitada" INTEGER NOT NULL,
    "cantidad_recibida" INTEGER NOT NULL,
    "precio_final" DECIMAL(65,30),
    "serial" TEXT,
    "estado" "EstadoItemRecepcion" NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotos" TEXT[],

    CONSTRAINT "recepciones_compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos_stock_compra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_ingreso" TEXT NOT NULL,
    "recepcion_id" UUID NOT NULL,
    "deposito_id" UUID NOT NULL,
    "usuario_ingreso_id" UUID NOT NULL,
    "estado" "EstadoIngresoStock" NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_stock_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos_stock_compra_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ingreso_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "recepcion_item_id" UUID,
    "cantidad" INTEGER NOT NULL,
    "serial" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_stock_compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_compra_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "devolucion_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "motivo_item" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rmas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_rma" TEXT NOT NULL,
    "orden_id" UUID,
    "devolucion_venta_id" UUID,
    "garantia_id" UUID,
    "orden_servicio_id" UUID,
    "cliente_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "serial_producto" TEXT,
    "tipo_rma" "TipoRma" NOT NULL,
    "motivo" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'normal',
    "estado" "EstadoRma" NOT NULL DEFAULT 'pendiente',
    "deposito_recepcion_id" UUID,
    "usuario_crea_id" UUID NOT NULL,
    "usuario_responsable_id" UUID,
    "fecha_recepcion" TIMESTAMPTZ(6),
    "diagnostico" TEXT,
    "resultado_diagnostico" "ResultadoDiagnosticoRma",
    "resolucion" "ResolucionRma",
    "producto_reemplazo_id" UUID,
    "serial_reemplazo" TEXT,
    "monto_reembolso" DECIMAL(65,30),
    "caja_movimiento_id" UUID,
    "fecha_cierre" TIMESTAMPTZ(6),
    "usuario_cierra_id" UUID,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rma_documentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rma_id" UUID NOT NULL,
    "tipo" "TipoDocumentoRma" NOT NULL,
    "url" TEXT NOT NULL,
    "nombre_original" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rma_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "tipo_evento" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT,
    "entidad" TEXT,
    "entidad_id" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_auth_user_id_key" ON "usuarios"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_pegasus_key" ON "clientes"("codigo_pegasus");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_pegasus_key" ON "productos"("codigo_pegasus");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_numero_orden_key" ON "ordenes"("numero_orden");

-- CreateIndex
CREATE UNIQUE INDEX "garantias_codigo_garantia_key" ON "garantias"("codigo_garantia");

-- CreateIndex
CREATE UNIQUE INDEX "garantias_orden_producto_id_key" ON "garantias"("orden_producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_codigo_pegasus_key" ON "proveedores"("codigo_pegasus");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_numero_orden_key" ON "ordenes_compra"("numero_orden");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_numero_cotizacion_key" ON "cotizaciones"("numero_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_compra_numero_devolucion_key" ON "devoluciones_compra"("numero_devolucion");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_ventas_numero_devolucion_key" ON "devoluciones_ventas"("numero_devolucion");

-- CreateIndex
CREATE UNIQUE INDEX "depositos_columna_stock_key" ON "depositos"("columna_stock");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_servicio_numero_orden_key" ON "ordenes_servicio"("numero_orden");

-- CreateIndex
CREATE UNIQUE INDEX "plan_cuentas_codigo_key" ON "plan_cuentas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "asientos_contables_numero_asiento_key" ON "asientos_contables"("numero_asiento");

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_codigo_key" ON "vendedores"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_depositos_producto_id_deposito_id_key" ON "productos_depositos"("producto_id", "deposito_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajustes_stock_numero_ajuste_key" ON "ajustes_stock"("numero_ajuste");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_compra_numero_recepcion_key" ON "recepciones_compra"("numero_recepcion");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_stock_compra_numero_ingreso_key" ON "ingresos_stock_compra"("numero_ingreso");

-- CreateIndex
CREATE UNIQUE INDEX "rmas_numero_rma_key" ON "rmas"("numero_rma");

-- AddForeignKey
ALTER TABLE "configuracion_sistema" ADD CONSTRAINT "configuracion_sistema_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_productos" ADD CONSTRAINT "orden_productos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_productos" ADD CONSTRAINT "orden_productos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_orden_producto_id_fkey" FOREIGN KEY ("orden_producto_id") REFERENCES "orden_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_creator_fkey" FOREIGN KEY ("creator") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_modifier_fkey" FOREIGN KEY ("modifier") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_aprobada_por_fkey" FOREIGN KEY ("aprobada_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_items" ADD CONSTRAINT "ordenes_compra_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_items" ADD CONSTRAINT "ordenes_compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_creator_fkey" FOREIGN KEY ("creator") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_modifier_fkey" FOREIGN KEY ("modifier") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_items" ADD CONSTRAINT "cotizaciones_items_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_items" ADD CONSTRAINT "cotizaciones_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_creator_fkey" FOREIGN KEY ("creator") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_modifier_fkey" FOREIGN KEY ("modifier") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_ventas" ADD CONSTRAINT "devoluciones_ventas_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_ventas" ADD CONSTRAINT "devoluciones_ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_ventas" ADD CONSTRAINT "devoluciones_ventas_creator_fkey" FOREIGN KEY ("creator") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_ventas" ADD CONSTRAINT "devoluciones_ventas_modifier_fkey" FOREIGN KEY ("modifier") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_clientes" ADD CONSTRAINT "pagos_clientes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_clientes" ADD CONSTRAINT "pagos_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_clientes" ADD CONSTRAINT "pagos_clientes_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_clientes" ADD CONSTRAINT "pagos_clientes_creator_fkey" FOREIGN KEY ("creator") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_clientes" ADD CONSTRAINT "pagos_clientes_modifier_fkey" FOREIGN KEY ("modifier") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedores" ADD CONSTRAINT "pagos_proveedores_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedores" ADD CONSTRAINT "pagos_proveedores_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedores" ADD CONSTRAINT "pagos_proveedores_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedores" ADD CONSTRAINT "pagos_proveedores_creator_fkey" FOREIGN KEY ("creator") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedores" ADD CONSTRAINT "pagos_proveedores_modifier_fkey" FOREIGN KEY ("modifier") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "tickets_soporte_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "tickets_soporte_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_tecnico_asignado_fkey" FOREIGN KEY ("tecnico_asignado") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalaciones" ADD CONSTRAINT "instalaciones_orden_servicio_id_fkey" FOREIGN KEY ("orden_servicio_id") REFERENCES "ordenes_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalaciones" ADD CONSTRAINT "instalaciones_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "plan_cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables_detalle" ADD CONSTRAINT "asientos_contables_detalle_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables_detalle" ADD CONSTRAINT "asientos_contables_detalle_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "plan_cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_cobrar" ADD CONSTRAINT "cuentas_cobrar_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_cobrar" ADD CONSTRAINT "cuentas_cobrar_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_cobrar" ADD CONSTRAINT "cuentas_cobrar_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_pagar" ADD CONSTRAINT "cuentas_pagar_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_pagar" ADD CONSTRAINT "cuentas_pagar_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_pagar" ADD CONSTRAINT "cuentas_pagar_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_pegasus" ADD CONSTRAINT "importaciones_pegasus_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eliminaciones_ordenes" ADD CONSTRAINT "eliminaciones_ordenes_eliminado_por_fkey" FOREIGN KEY ("eliminado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_series" ADD CONSTRAINT "productos_series_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_log" ADD CONSTRAINT "actividad_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_ventas_items" ADD CONSTRAINT "devoluciones_ventas_items_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones_ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_ventas_items" ADD CONSTRAINT "devoluciones_ventas_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_depositos" ADD CONSTRAINT "productos_depositos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_depositos" ADD CONSTRAINT "productos_depositos_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock" ADD CONSTRAINT "ajustes_stock_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock" ADD CONSTRAINT "ajustes_stock_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock" ADD CONSTRAINT "ajustes_stock_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock_items" ADD CONSTRAINT "ajustes_stock_items_ajuste_id_fkey" FOREIGN KEY ("ajuste_id") REFERENCES "ajustes_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock_items" ADD CONSTRAINT "ajustes_stock_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra" ADD CONSTRAINT "recepciones_compra_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra" ADD CONSTRAINT "recepciones_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra" ADD CONSTRAINT "recepciones_compra_usuario_recepcion_id_fkey" FOREIGN KEY ("usuario_recepcion_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra" ADD CONSTRAINT "recepciones_compra_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra_items" ADD CONSTRAINT "recepciones_compra_items_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra_items" ADD CONSTRAINT "recepciones_compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock_compra" ADD CONSTRAINT "ingresos_stock_compra_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock_compra" ADD CONSTRAINT "ingresos_stock_compra_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock_compra" ADD CONSTRAINT "ingresos_stock_compra_usuario_ingreso_id_fkey" FOREIGN KEY ("usuario_ingreso_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock_compra_items" ADD CONSTRAINT "ingresos_stock_compra_items_ingreso_id_fkey" FOREIGN KEY ("ingreso_id") REFERENCES "ingresos_stock_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock_compra_items" ADD CONSTRAINT "ingresos_stock_compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_stock_compra_items" ADD CONSTRAINT "ingresos_stock_compra_items_recepcion_item_id_fkey" FOREIGN KEY ("recepcion_item_id") REFERENCES "recepciones_compra_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra_items" ADD CONSTRAINT "devoluciones_compra_items_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra_items" ADD CONSTRAINT "devoluciones_compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_devolucion_venta_id_fkey" FOREIGN KEY ("devolucion_venta_id") REFERENCES "devoluciones_ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "garantias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_orden_servicio_id_fkey" FOREIGN KEY ("orden_servicio_id") REFERENCES "ordenes_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_deposito_recepcion_id_fkey" FOREIGN KEY ("deposito_recepcion_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_usuario_crea_id_fkey" FOREIGN KEY ("usuario_crea_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_usuario_responsable_id_fkey" FOREIGN KEY ("usuario_responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_producto_reemplazo_id_fkey" FOREIGN KEY ("producto_reemplazo_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_caja_movimiento_id_fkey" FOREIGN KEY ("caja_movimiento_id") REFERENCES "caja_movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_usuario_cierra_id_fkey" FOREIGN KEY ("usuario_cierra_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_documentos" ADD CONSTRAINT "rma_documentos_rma_id_fkey" FOREIGN KEY ("rma_id") REFERENCES "rmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
