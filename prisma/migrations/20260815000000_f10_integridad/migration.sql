-- CreateEnum
CREATE TYPE "EstadoCajaOrden" AS ENUM ('pendiente_envio', 'cobrado', 'parcial', 'facturado', 'anulado');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('pendiente', 'aprobada', 'rechazada', 'caducada');

-- AlterTable
ALTER TABLE "cotizaciones" DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoCotizacion" DEFAULT 'pendiente';

-- AlterTable
ALTER TABLE "ordenes" DROP COLUMN "estado_caja",
ADD COLUMN     "estado_caja" "EstadoCajaOrden" DEFAULT 'pendiente_envio';

-- AlterTable
ALTER TABLE "tickets_soporte" DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoTicket" NOT NULL DEFAULT 'pendiente',
DROP COLUMN "prioridad",
ADD COLUMN     "prioridad" "Prioridad" NOT NULL DEFAULT 'normal';

-- CreateIndex
CREATE INDEX "asientos_contables_referencia_tipo_referencia_id_idx" ON "asientos_contables"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE INDEX "caja_movimientos_orden_id_idx" ON "caja_movimientos"("orden_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_cobrar_orden_id_key" ON "cuentas_cobrar"("orden_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_pagar_orden_compra_id_key" ON "cuentas_pagar"("orden_compra_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_stock_compra_recepcion_id_key" ON "ingresos_stock_compra"("recepcion_id");

-- CreateIndex
CREATE INDEX "orden_productos_orden_id_idx" ON "orden_productos"("orden_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_series_producto_id_serial_key" ON "productos_series"("producto_id", "serial");
