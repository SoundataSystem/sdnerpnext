-- CreateTable
CREATE TABLE "numeradores" (
    "tipo" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "numeradores_pkey" PRIMARY KEY ("tipo")
);

-- Seed por tipo/año desde los datos existentes (secuencia por año, formato PREFIJO-AAAA-SEQ)
INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'orden:' || SPLIT_PART(numero_orden, '-', 2), COALESCE(MAX(SPLIT_PART(numero_orden, '-', 3)::INT), 0)
FROM "ordenes" WHERE numero_orden LIKE 'VTA-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'orden_compra:' || SPLIT_PART(numero_orden, '-', 2), COALESCE(MAX(SPLIT_PART(numero_orden, '-', 3)::INT), 0)
FROM "ordenes_compra" WHERE numero_orden LIKE 'OC-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'recepcion:' || SPLIT_PART(numero_recepcion, '-', 2), COALESCE(MAX(SPLIT_PART(numero_recepcion, '-', 3)::INT), 0)
FROM "recepciones_compra" WHERE numero_recepcion LIKE 'RC-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'ingreso:' || SPLIT_PART(numero_ingreso, '-', 2), COALESCE(MAX(SPLIT_PART(numero_ingreso, '-', 3)::INT), 0)
FROM "ingresos_stock_compra" WHERE numero_ingreso LIKE 'IG-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'ajuste:' || SPLIT_PART(numero_ajuste, '-', 2), COALESCE(MAX(SPLIT_PART(numero_ajuste, '-', 3)::INT), 0)
FROM "ajustes_stock" WHERE numero_ajuste LIKE 'AJ-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'devolucion_venta:' || SPLIT_PART(delivery_no, '-', 2), COALESCE(MAX(SPLIT_PART(delivery_no, '-', 3)::INT), 0)
FROM "devoluciones_ventas" WHERE delivery_no LIKE 'DV-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'devolucion_compra:' || SPLIT_PART(supplier_order_number, '-', 2), COALESCE(MAX(SPLIT_PART(supplier_order_number, '-', 3)::INT), 0)
FROM "devoluciones_compra" WHERE supplier_order_number LIKE 'DC-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'orden_servicio:' || SPLIT_PART(numero_orden, '-', 2), COALESCE(MAX(SPLIT_PART(numero_orden, '-', 3)::INT), 0)
FROM "ordenes_servicio" WHERE numero_orden LIKE 'OS-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'rma:' || SPLIT_PART(numero_rma, '-', 2), COALESCE(MAX(SPLIT_PART(numero_rma, '-', 3)::INT), 0)
FROM "rmas" WHERE numero_rma LIKE 'RMA-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'garantia:' || SPLIT_PART(codigo_garantia, '-', 2), COALESCE(MAX(SPLIT_PART(codigo_garantia, '-', 3)::INT), 0)
FROM "garantias" WHERE codigo_garantia LIKE 'G-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'cotizacion:' || SPLIT_PART(numero_cotizacion, '-', 2), COALESCE(MAX(SPLIT_PART(numero_cotizacion, '-', 3)::INT), 0)
FROM "cotizaciones" WHERE numero_cotizacion LIKE 'CTZ-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'asiento:' || SPLIT_PART(numero_asiento, '-', 2), COALESCE(MAX(SPLIT_PART(numero_asiento, '-', 3)::INT), 0)
FROM "asientos_contables" WHERE numero_asiento LIKE 'AS-%-%' GROUP BY 1;

INSERT INTO "numeradores" ("tipo", "ultimo")
SELECT 'ticket:' || SPLIT_PART(numero_ticket, '-', 2), COALESCE(MAX(SPLIT_PART(numero_ticket, '-', 3)::INT), 0)
FROM "tickets_soporte" WHERE numero_ticket LIKE 'TKT-%-%' GROUP BY 1;

-- P2-7: numero_ticket ahora único (generado por numerador atómico, sin colisiones)
-- CreateIndex
CREATE UNIQUE INDEX "tickets_soporte_numero_ticket_key" ON "tickets_soporte"("numero_ticket");
