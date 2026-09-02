-- Migración para agregar tablas de outbox e idempotencia
-- Ejecutar directamente en la base de datos

-- Crear enum para estado de evento outbox
DO $$ BEGIN
    CREATE TYPE "EstadoEventoOutbox" AS ENUM ('PENDIENTE', 'PROCESANDO', 'PROCESADO', 'FALLIDO', 'DESCARTADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Crear tabla EventoOutbox
CREATE TABLE IF NOT EXISTS "eventos_outbox" (
    id               UUID NOT NULL DEFAULT gen_random_uuid(),
    tipo             TEXT NOT NULL,
    correlation_id   TEXT NOT NULL,
    actor_id         UUID,
    actor_nombre     TEXT,
    actor_rol        TEXT,
    entidad          TEXT NOT NULL,
    entidad_id       TEXT NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos     JSONB,
    metadata         JSONB,
    estado           "EstadoEventoOutbox" NOT NULL DEFAULT 'PENDIENTE',
    intentos         INT NOT NULL DEFAULT 0,
    ultimo_error     TEXT,
    created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    procesado_en     TIMESTAMPTZ(6),
    CONSTRAINT "eventos_outbox_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "eventos_outbox_estado_created_at_idx" ON "eventos_outbox" ("estado", "created_at");
CREATE INDEX IF NOT EXISTS "eventos_outbox_correlation_id_idx" ON "eventos_outbox" ("correlation_id");
CREATE INDEX IF NOT EXISTS "eventos_outbox_entidad_entidad_id_idx" ON "eventos_outbox" ("entidad", "entidad_id");

-- Crear tabla IdempotenciaClave
CREATE TABLE IF NOT EXISTS "idempotencia_claves" (
    id            UUID NOT NULL DEFAULT gen_random_uuid(),
    clave         TEXT NOT NULL UNIQUE,
    tipo          TEXT NOT NULL,
    entidad_id    TEXT NOT NULL,
    entidad_tipo  TEXT NOT NULL,
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "idempotencia_claves_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "idempotencia_claves_tipo_idx" ON "idempotencia_claves" ("tipo");
CREATE INDEX IF NOT EXISTS "idempotencia_claves_entidad_tipo_entidad_id_idx" ON "idempotencia_claves" ("entidad_tipo", "entidad_id");