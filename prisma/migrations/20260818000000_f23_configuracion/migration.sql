-- FASE 23: Configuración del sistema extendida (módulo Configuración).
-- Agrega los contactos de documentos (email/teléfono) usados por el ticket/certificados,
-- replicando las columnas que el ERP REACT ya tiene en configuracion_sistema.
ALTER TABLE "configuracion_sistema"
  ADD COLUMN IF NOT EXISTS "email_contacto" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "telefono_contacto" TEXT DEFAULT '';