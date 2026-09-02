-- FASE 24: Restauración del ERP. Columnas de cotizaciones presentes en el dump fuente (ERP React) y no modeladas en v2.
ALTER TABLE "cotizaciones"
  ADD COLUMN IF NOT EXISTS "vendedor_codigo" TEXT,
  ADD COLUMN IF NOT EXISTS "vendedor_nombre" TEXT,
  ADD COLUMN IF NOT EXISTS "sucursal" TEXT,
  ADD COLUMN IF NOT EXISTS "moneda" TEXT NOT NULL DEFAULT 'GS',
  ADD COLUMN IF NOT EXISTS "tipo_cambio" DECIMAL(10,2) NOT NULL DEFAULT 1;