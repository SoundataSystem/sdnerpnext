-- FASE 25: Restauración del ERP. El dump fuente de producción tiene duplicados reales de
-- producto_id+serial en productos_series (reimportaciones de stock en fechas distintas).
-- v2 había asumido unicidad (F10) pero los datos históricos la violan; se elimina el índice único
-- y se conservan los 30.170 registros tal cual.
DROP INDEX IF EXISTS "productos_series_producto_id_serial_key";