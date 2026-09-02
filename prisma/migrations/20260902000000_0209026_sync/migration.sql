-- Sync with backup 0209026 (2026-09-02 11:02): new columns and enum values added manually to Supabase
ALTER TYPE "TipoMovimientoInventario" ADD VALUE IF NOT EXISTS 'devolucion_venta';
ALTER TYPE "TipoMovimientoInventario" ADD VALUE IF NOT EXISTS 'devolucion_compra';
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "incluye_iva" BOOLEAN DEFAULT false;
ALTER TABLE "devoluciones_ventas" ADD COLUMN IF NOT EXISTS "es_nota_credito" BOOLEAN DEFAULT false;
ALTER TABLE "devoluciones_ventas" ADD COLUMN IF NOT EXISTS "credito_cuentas_cobrar_id" UUID;
