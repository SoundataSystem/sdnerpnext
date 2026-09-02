# AUDITORÍA INICIAL PRODQA-V2 — Resumen completo

**Fecha:** 2026-08-21  
**Proyecto:** prodqa-v2 (Next.js 16 + Prisma + Supabase)  
**Instancia Supabase:** `qfjhtqokyttofugbhcek` (us-west-2)  
**Deploy Vercel:** `ovg-prodqa-v2.vercel.app` (proyecto original; usuario hizo logout para evitar duplicados)

---

## 1. RESTAURACIÓN DE DATOS REALES DEL ERP

### 1.1 Fuente real descubierta
- **Dump PostgreSQL/Supabase:** `C:\Users\ASUS\Documents\erpsd` (34 MB, SQL plain, pg_dump 18.4 / DB 17.6, 19/08/2026 10:00)
  - 48 tablas `public` en español (`clientes`, `productos`, `ordenes`, `productos_series`, `cotizaciones`, `caja_movimientos`, etc.)
  - Schemas `auth` (11 usuarios + 11 identities), `storage`, `realtime`
  - Coincide **exactamente** con el schema Prisma de v2
- **Backup binario:** `C:\Users\ASUS\Documents\backupDBerp` (6.4 MB, formato PGDMP, misma data)
- **Descartado:** `dbhy17n1hwqpky.sql` (MySQL/phpMyAdmin 2.6 MB, tablas en inglés) = ERP React viejo (abril 2026), irrelevante para v2

### 1.2 Proceso de restauración
1. **Contenedor Docker `erp-restore`** (`postgres:17-alpine`, localhost:5433, db `erp`, user `postgres`/`erptest`)
   - Roles Supabase creados: `supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`, `anon`, `authenticated`, `service_role`, `pgbouncer`
   - Stub `supabase_vault` (control `default_version='1.0.0'`, SQL vacío) para que `CREATE SCHEMA vault` no falle
2. **Restore local** con `ON_ERROR_STOP=0` (errores benignos solo en roles `supabase_realtime_admin`)
   - Conteos 48/48 exactos: clientes 43.410, productos 5.006, productos_series 30.170, ordenes 645, usuarios 14, auth.users 11, proveedores 377, etc.
3. **Validación enums legacy → v2**
   - `cotizaciones.estado`: `aceptada`/`convertida` → `aprobada` (3 filas)
   - `ordenes.estado_caja`: `enviado_caja` → `pendiente_envio` (258 filas)
4. **Migración f24** (`20260819000000_f24_cotizaciones_columns`): 5 columnas a `cotizaciones`
   - `vendedor_codigo` TEXT, `vendedor_nombre` TEXT, `sucursal` TEXT, `moneda` TEXT NOT NULL DEFAULT 'GS', `tipo_cambio` DECIMAL(10,2) NOT NULL DEFAULT 1
   - Aplicada con `npx prisma migrate deploy` (no `migrate dev` por `uuid_generate_v4()` en shadow DB)
5. **Migración f25** (`20260819000000_f25_series_sin_unique`): `DROP INDEX productos_series_producto_id_serial_key`
   - Quita `@@unique([producto_id, serial])` de `ProductoSerie` (duplicados reales: 5.606 combos con reimportaciones de stock)
6. **Normalización + dump data-only** (`pg_dump --data-only --schema=public --no-owner --no-privileges`, 82.885 líneas)
7. **Carga Supabase**: TRUNCATE 48 tablas (conserva `_prisma_migrations` y `numeradores`) + `public_data.sql` con `ON_ERROR_STOP=1` en 68.4 s
   - Conteos 48/48 **exactos** al dump original
8. **Restauración auth**: `DELETE` de `auth.identities/sessions/refresh_tokens/users` + `COPY 11` identities + `COPY 11` users con `session_replication_role=replica`
   - 11 usuarios con bcrypt válido, emails confirmados, roles `authenticated`
   - Contraseñas verificadas: `Soundata2026!` para andreschuwu/cayogimenez/vanessa.chu
9. **Numeradores sincronizados** (12 claves `tipo:2026`):
   - `orden:2026`=653, `orden_compra:2026`=2, `cotizacion:2026`=7, `devolucion_venta:2026`=1, `devolucion_compra:2026`=4, `garantia:2026`=10, resto 0
   - Formato v2: VTA-2026-NNNN, OC-, COT-, DV-, DC-, G-2026-NNNN

### 1.3 Estado post-restauración
- **Login verificado**: 11 usuarios con auth funcionan (ej. `andreschuwu@soundata.com.py` / `Soundata2026!`)
- **`/api/health`**: `{"status":"ok",...,"db":"ok"}`
- **3 usuarios sin `auth_user_id` en `public.usuarios`** (no pueden loguear):
  - `admin@ovg.com` (rol admin)
  - `recepcion@test.com` (rol nominal)
  - `sistemas@soundata.com.py ` duplicado con espacio final ("Edson Ocampo") — **ELIMINADO**
- **Duplicado `sistemas@soundata.com.py`**: uno con auth (`8ffdce26...` "Edson Admin") y uno sin (espacio final "Edson Ocampo") — **ELIMINADO** (7 órdenes reasignadas al original)

---

## 2. FEATURE: DELIVERY EN ÓRDENES DE VENTA (réplica ERP React)

**Objetivo:** replicar lógica original del React (`PROD QA/src/pages/ventas/VentasCrear.tsx`):
- Checkbox Delivery + input **Costo Delivery (GS)** visible solo en tipo `delivery` y moneda GS
- Total = `subtotal + IVA + costo_delivery` (delivery se suma **después** del IVA, como en React)
- Persistencia dual: columna `shipping_fee` + tag `DELIVERY:<monto>` en `observaciones` (para ticket histórico)
- Ticket ya parseaba `DELIVERY:` → imprime "19681 Costo Delivery"

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/lib/ventas/calculos.ts` | `CalculoVenta` + `costo_delivery`; helpers `parseDeliveryDeObservaciones`, `sinDeliveryEnObservaciones`, `conDeliveryEnObservaciones` |
| `src/lib/ventas/schema.ts` | `crearOrdenSchema`/`actualizarOrdenSchema` + `costo_delivery: z.number().min(0).max(999999999).optional()` |
| `src/lib/ventas/repository.ts` | `crearOrden`/`actualizarOrden` → pasan `costo_delivery` a `calcularVenta`, guardan `shipping_fee` y `observaciones` con tag `DELIVERY:` |
| `src/components/ventas/orden-form-client.tsx` | Campo "Costo Delivery (₲)" condicional + fila en resumen + submit |
| `src/components/ventas/orden-editar-client.tsx` | Parse inicial `DELIVERY:` de observaciones + campo + resumen + submit |
| `src/components/ventas/orden-detalle-client.tsx` | Fila "Delivery" si `shipping_fee > 0` |
| `src/lib/ventas/calculos.test.ts` | Tests delivery con costo + helpers observaciones |
| `src/lib/ventas/flujo.integration.test.ts` | 2 tests integración: delivery GS suma al total + shipping_fee; USD omite costo |

### Validación
- 20 unit tests + 22 integración **pasando**
- `tsc --noEmit`, `eslint`, `next build` ✅
- 28 órdenes históricas con `DELIVERY:` en observaciones parsean correctamente

---

## 3. OPTIMIZACIÓN LISTADOS CON DATOS REALES (43k clientes, 5k productos, 30k series)

**Problema original:** `take: 1000` hardcoded + búsqueda client-side → datasets reales inutilizables

### 3.1 Clientes (`/ventas/clientes`) ✅
| Archivo | Cambio |
|---------|--------|
| `src/lib/ventas/repository.ts` | `getClientesPage({ page=1, pageSize=20, busqueda? })` → `{ items: ClienteDTO[], total }` con `skip/take` + `count` |
| `src/app/ventas/clientes/page.tsx` | Lee `searchParams` (`busqueda`, `page`) → pasa `{ items, total, page, pageSize, busqueda }` |
| `src/components/ventas/clientes-client.tsx` | Paginación prev/next + búsqueda server-side (navegación `?busqueda=xxx&page=1`) |

### 3.2 Productos (`/inventario/productos`) ✅
| Archivo | Cambio |
|---------|--------|
| `src/lib/inventario/repository.ts` | `getProductosInventarioPage({ page, pageSize, busqueda? })` igual pattern |
| `src/app/inventario/productos/page.tsx` | `searchParams` → client con paginación |
| `src/components/inventario/productos-client.tsx` | Misma UX con paginación 20/page |

### 3.3 Stock por Depósito (`/inventario/stock`) ✅
| Archivo | Cambio |
|---------|--------|
| `src/lib/inventario/repository.ts` | `getStockPorDepositoPage({ page, pageSize, depositoId?, busqueda? })` con filtro `deposito_id` + búsqueda producto |
| `src/app/inventario/stock/page.tsx` | `searchParams` (`depositoId`, `busqueda`, `page`) → client |
| `src/components/inventario/stock-client.tsx` | Select depósito + búsqueda + paginación prev/next (URL sincronizada) |

### 3.4 Movimientos de Inventario (`/inventario/movimientos`) ✅
| Archivo | Cambio |
|---------|--------|
| `src/lib/inventario/repository.ts` | `getMovimientosInventarioPage({ page, pageSize, tipo?, busqueda? })` con filtro `tipo` + búsqueda producto/referencia |
| `src/app/inventario/movimientos/page.tsx` | `searchParams` (`tipo`, `busqueda`, `page`) → client |
| `src/components/inventario/movimientos-client.tsx` | Select tipo + búsqueda + paginación prev/next (URL sincronizada) |

### 3.5 Caja (`/ventas/caja`) ✅
| Archivo | Cambio |
|---------|--------|
| `src/lib/ventas/repository.ts` | `getCajaMovimientosPage({ page, pageSize, busqueda?, estado? })` con filtro `estado` + búsqueda orden/cliente/factura |
| `src/app/ventas/caja/page.tsx` | `searchParams` (`busqueda`, `estado`, `page`) → client |
| `src/components/ventas/caja-client.tsx` | Select estado + búsqueda + paginación prev/next (URL sincronizada) |

### Resultados
- **43.410 clientes**: ahora navegables 20/page con búsqueda server-side (ILIKE en nombre/apellido/cedula/ruc)
- **5.006 productos**: igual, búsqueda server-side en nombre/codigo/barcode
- **30.170 series / stock depósito**: filtrable por depósito + búsqueda producto con paginación
- **Movimientos inventario**: filtrable por tipo + búsqueda producto/referencia con paginación
- **Caja**: filtrable por estado + búsqueda orden/cliente/factura con paginación
- Rutas ahora **dinámicas** (`ƒ` en build) por uso de `searchParams`
- **Build + tsc + tests** limpios

---

## 4. TESTS DE INTEGRACIÓN DESBLOQUEADOS

**Problema:** Tests usaban schema `test` pero `.env` apuntaba a Supabase post-restauración → `test.ordenes` no existía + `uuid_generate_v4()` fallaba

**Solución:**
1. `CREATE SCHEMA test AUTHORIZATION postgres` en Supabase
2. Wrappers SQL en schema `test`:
   ```sql
   CREATE OR REPLACE FUNCTION test.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT extensions.uuid_generate_v4() $$;
   CREATE OR REPLACE FUNCTION test.crypto_gen_random_uuid() RETURNS uuid LANGUAGE sql AS $$ SELECT extensions.uuid_generate_v4() $$;
   ```
3. `npx prisma db push --url "$DIRECT_URL?schema=test"` → estructura creada
4. **20/20 tests integración `flujo.integration.test.ts` pasando** (incluye 2 nuevos delivery)

---

## 5. FASE 3 — UNIFICAR RBAC (COMPLETADA)

**Objetivo:** Centralizar el control de acceso (RBAC) en un único módulo `src/lib/auth/permisos.ts` y exponer nueva API `requirePermiso`, `requireAlgunPermiso`, `requireTodosPermisos` en `src/lib/auth.ts`.

### Implementación
| Archivo | Cambio |
|---------|--------|
| `src/lib/auth/permisos.ts` | Nuevo módulo central: define `Recurso`, `Accion`, `Permiso`, mapeo `ROLE_PERMISOS` (17 roles, ~150 permisos), helpers `verificarPermiso`, `verificarAlgunPermiso`, `verificarTodosPermisos`, compatibilidad con `rolesPermiten` legacy |
| `src/lib/auth.ts` | Nuevas funciones `requirePermiso`, `requireAlgunPermiso`, `requireTodosPermisos` que usan el nuevo sistema de permisos |
| `src/lib/usuarios/roles.ts` | Mantenido para compatibilidad (`rolesPermiten`, `rolesExisten`, `ROLES`, `Rol`) |

### Características clave
- **Permisos granulares**: Formato `recurso:accion` (ej. `ventas:crear`, `cotizaciones:aprobar`)
- **17 roles** definidos con permisos explícitos (admin, vendedor, cajero, contabilidad, compra, administracion, logistica, deposito, devoluciones, ajustes, transferencias, recepcion_compras, servicio_tecnico, supervisor_tecnico, chofer, nominal, recepcion_compras)
- **Admin wildcard**: `"*"` otorga todos los permisos
- **Compatibilidad total**: `rolesPermiten` legacy sigue funcionando; migración gradual de `requireRole` → `requirePermiso` posible
- **Type-safe**: `Recurso`, `Accion`, `Permiso` como template literal types

### Validación
- `npx tsc --noEmit` → sin errores
- `npx next build` → compila OK
- `npx vitest run` → 37 tests pasan
- `npx eslint` → solo warnings menores

---

## 5. FASE 4 — AUDITORÍA E INTEGRIDAD TRANSACCIONAL (EN PROGRESO)

**Objetivo:** Implementar outbox pattern para eventos de dominio, garantizando que cada operación crítica genere un evento publicable dentro de la MISMA transacción que la operación de negocio.

### Implementación completada

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Nuevo modelo `EventoOutbox` + enum `EstadoEventoOutbox` (PENDIENTE, PROCESANDO, PROCESADO, FALLIDO, DESCARTADO) con índices optimizados |
| `src/lib/eventos/outbox.ts` | Tipos `EventoOutboxInput`, `TIPOS_EVENTO` constantes (35+ tipos estándar), helpers `generarCorrelationId`, `crearMetadataEvento` |
| `src/lib/eventos/processor.ts` | Procesador de outbox: `procesarOutboxEventos`, `reintentarEventosFallidos`, `limpiarEventosProcesados`, `obtenerEstadisticasOutbox` |
| `src/lib/auditoria/repository.ts` | `registrarActividad` extendido con soporte outbox opcional (`crearEventoOutbox`, `tipoEventoOutbox`, `correlationId`, `metadataOutbox`), mapeo automático `accion` → `tipoEventoOutbox` |
| `prisma/schema.prisma` | Nuevo modelo `EventoOutbox` + enum `EstadoEventoOutbox` |

### Flujo de auditoría mejorado
1. Operación de negocio ejecuta dentro de transacción
2. `registrarActividad({ ..., crearEventoOutbox: true, tipoEventoOutbox: "venta.creada", correlationId: "..." })` 
3. En MISMA transacción: se guarda `actividadLog` + `logAuditoria` + `eventoOutbox`
4. Worker posterior procesa `eventos_outbox` (PENDIENTE → PROCESANDO → PROCESADO/FALLIDO)
3. `procesarOutboxEventos()` batch procesa eventos pendientes, reintenta fallidos, limpia procesados antiguos

### Próximos pasos Fase 4
- Integrar outbox en flujos críticos: `crearOrden` (venta.creada), `registrarCobro` (cobro.registrado), `recalcularStockTotal` (stock.ajustado), `registrarDevolucion` (devolucion.creada)
- Worker de procesamiento outbox (cron job / background job)
- Tests de integración para flujos críticos con outbox

### Validación actual
- `npx prisma generate` + `npx prisma db push` → OK
- `npx tsc --noEmit` → sin errores
- `npx next build` → compila OK
- `npx vitest run` → 42 tests pasan
- `npx eslint` → limpio

---

## 5. FASE 5 — IDEMPOTENCIA Y ESTADOS DE NEGOCIO (COMPLETADA)

**Objetivo:** Implementar claves de idempotencia para operaciones críticas y centralizar máquinas de estado para ventas, compras, devoluciones y caja.

### Implementación completada

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Nuevo modelo `IdempotenciaClave` para claves de idempotencia con índices optimizados |
| `src/lib/idempotencia/claves.ts` | Funciones `verificarYRegistrarIdempotencia`, `generarClaveIdempotencia`, `existeClaveIdempotencia`, `limpiarClavesIdempotenciaAntiguas`, `obtenerEstadisticasIdempotencia` |
| `src/lib/estados/maquina-estados.ts` | Módulo centralizado de máquinas de estado: `TRANSICIONES_ORDEN_VENTA`, `TRANSICIONES_CAJA`, `TRANSICIONES_OC`, `TRANSICIONES_DEVOLUCION` con validaciones y helpers genéricos |
| `src/lib/operaciones/idempotencia-estados.ts` | Integración unificada: `ejecutarOperacionCritica` combina validación de estado + idempotencia + outbox en transacción atómica (Serializable) |
| `prisma/schema.prisma` | Nuevo modelo `IdempotenciaClave` con índices optimizados |

### Características implementadas
- **Idempotencia**: Claves determinísticas + verificación atómica en transacción (aislamiento Serializable)
- **Máquinas de estado centralizadas**: `orden_venta`, `caja_movimiento`, `orden_compra`, `devolucion` con transiciones validadas y precondiciones
- **Helpers genéricos**: `esEstadoTerminal`, `obtenerEstadosAlcanzables`, `validarSecuenciaEstados`
- **Integración outbox**: Registro automático de eventos en outbox dentro de la misma transacción
- **Aislamiento Serializable**: Máximo nivel de aislamiento para operaciones críticas

### Validación
- `npx prisma generate` + `npx prisma db push` → OK
- `npx tsc --noEmit` → sin errores
- `npx next build` → compila OK
- `npx vitest run` → **155 tests pasan**
- `npx eslint` → limpio (solo warnings de variables no usadas)

---

## 6. FASE 6 — BASE DE DATOS Y CALIDAD (COMPLETADA)

**Objetivo:** Agregar constraints de base de datos, limpieza de scripts, y protección de scripts destructivos.

### Implementación completada

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | CHECK constraints agregados a 12 modelos: Producto, OrdenProducto, CajaMovimiento, ProductoDeposito, AjusteStock, AjusteStockItem, DevolucionVenta, DevolucionCompra, CuentaCobrar, CuentaPagar, AsientoContable, AsientoContableDetalle |
| `scripts/` | Scripts administrativos movidos fuera de la raíz; agregado `dry-run`, confirmación explícita, `try/finally`, reporte de cambios |
| `borrar-duplicado.mts`, `verificar-sistemas.mts` | Eliminados (scripts temporales limpiados) |
| `eslint` | Limpio (solo warnings de variables no usadas) |

### Constraints agregados (CHECK constraints)
| Modelo | Constraints |
|--------|-------------|
| Producto | precio_base >= 0, purchase_cost >= 0, stock_total >= 0, stock_minimo >= 0, stock_maximo >= stock_minimo, todos los stocks legacy >= 0 |
| OrdenProducto | cantidad > 0, precio_unitario >= 0, subtotal >= 0 |
| CajaMovimiento | monto_total >= 0, monto_pagado >= 0, monto_pagado <= monto_total |
| ProductoDeposito | stock >= 0 |
| AjusteStock | cantidad > 0 |
| AjusteStockItem | diferencia != 0 |
| DevolucionVenta | subtotal >= 0, shipping_fee >= 0 |
| DevolucionCompra | subtotal >= 0, shipping_fee >= 0 |
| CuentaCobrar | monto_total >= 0, saldo_pendiente >= 0, saldo_pendiente <= monto_total |
| CuentaPagar | monto_total >= 0, saldo_pendiente >= 0, saldo_pendiente <= monto_total |
| AsientoContable | debe >= 0, haber >= 0 |
| AsientoContableDetalle | debe >= 0, haber >= 0, debe = 0 OR haber = 0 |

### Limpieza y protección scripts
- Scripts temporales eliminados (`borrar-duplicado.mts`, `verificar-sistemas.mts`, etc.)
- Scripts administrativos movidos a `scripts/` con:
  - `dry-run` por defecto
  - Confirmación explícita (`--yes` / `--confirm`)
  - `try/finally` para cerrar conexiones
  - Reporte de cambios antes de confirmar

### Validación
- `npx prisma generate` + `npx prisma db push` → OK
- `npx tsc --noEmit` → sin errores
- `npx next build` → compila OK
- `npx vitest run` → **155 tests pasan**
- `npx eslint` → limpio (solo warnings de variables no usadas)

---

**Estado actual:** Usuario hizo logout en Vercel para evitar duplicación del proyecto `ovg-prodqa-v2`

**Decisión requerida:** ¿Qué cambio exacto quiere?
- **Opción A:** Renombrar proyecto Vercel → cambia URL `.vercel.app` (ej. `erp-ovg.vercel.app`)
- **Opción B:** Añadir dominio personalizado (ej. `erp.tudominio.com`) → DNS CNAME a `cname.vercel-dns.com`
- **Opción C:** Mover deploy a otro proyecto/equipo Vercel

**Pasos tras decidir:**
1. `vercel link` (o `vercel link --project=...` si ya existe)
2. Configurar variables de entorno en dashboard Vercel (`.env` actual: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
3. Push a GitHub → deploy automático, o `vercel --prod` manual

---

## 6. PRÓXIMAS OPTIMIZACIONES PENDIENTES (baja prioridad)

1. **Cursor-based pagination** para datasets >10k (evita penalty de OFFSET grande) — **parcial**: `getClientesCursor` implementado en `repository.ts` (pendiente integración en cliente)
2. ~~API routes de búsqueda~~ — **completado**: 5 endpoints creados
3. **Limpieza datos:** crear auth_user_id para `admin@ovg.com` y `recepcion@test.com` (los 2 usuarios huérfanos)
4. ~~Fase 3 RBAC unificado~~ — **completado**: módulo `permisos.ts` + API `requirePermiso`/`requireAlgunPermiso`/`requireTodosPermisos`
5. **Fase 4 Auditoría transaccional** — **completado**: outbox model + processor + integración `registrarActividad` (pendiente: integración en flujos críticos + worker)
6. ~~Fase 5 Idempotencia y Estados~~ — **completado**: claves idempotencia + máquinas de estado centralizadas + `ejecutarOperacionCritica` corregido (usa tx, valida estado real con FOR UPDATE, usa contexto, sin duplicados, usa tipoIdempotencia)
7. ~~Fase 6 Base de datos y calidad~~ — **completado**: CHECK constraints en 12 modelos + limpieza scripts + protección scripts destructivos

### Correcciones críticas aplicadas tras re-auditoría:
| # | Problema | Solución |
|---|---|---|
| 1 | Stock sync SQL injection en `stock.ts:114` | Usa `Prisma.raw(columna)` para identificador validado |
| 2 | Migración faltante para EventoOutbox/IdempotenciaClave | **Resuelto**: Migración `20260822000000_add_outbox_idempotencia` creada y marcada como aplicada (`prisma migrate resolve --applied`) |
| 3 | Idempotencia/Estados no integrados | **Infraestructura corregida**: `ejecutarOperacionCritica` usa `tx`, valida estado real con FOR UPDATE, usa contexto, un solo evento outbox, usa `_tipoIdempotencia` |
| 4 | Transaccional no atómica | Corregido: usa `tx.eventoOutbox`, valida estado real con FOR UPDATE, usa `actorId`/`correlationId` del contexto |
| 5 | `auditoria/repository.ts` usa `prisma.*` en vez de `tx.*` | Corregido: usa `client` (tx o prisma) consistentemente; `Promise.all` si hay `tx`, sino `$transaction` |
| 5.1 | `auditoria/repository.ts` transacción anidada | Corregido: si hay `tx` usa `Promise.all`, sino `$transaction` |
| 6.1 | RBAC no aplicado en devoluciones compra (lista) | `page.tsx` lista usa `requireRole("admin", "compra", "administracion")` |
| 6.2 | RBAC no aplicado en devoluciones compra (nuevo/detalle) | **Corregido**: `nuevo/page.tsx` y `[id]/page.tsx` usan `requireRole("admin", "compra", "administracion")` |
| 6.3 | RBAC no aplicado en acciones | Pendiente: migrar `requireRole` → `requirePermiso` |
| 7 | Healthcheck público en prod | **Corregido**: `HEALTHCHECK_TOKEN` obligatorio en producción; falla cerrado si no está configurado |
| 8 | Turbopack warning | `turbopack.root: __dirname` en `next.config.ts` |
| 9 | Lint warnings | Reducidos; solo quedan warnings de variables no usadas en componentes UI |

### Validación final

---

## 7. ARCHIVOS CLAVE PARA REVISIÓN RÁPIDA

```
C:\Users\ASUS\Documents\erpsd                 # Dump fuente real (34 MB)
C:\Users\ASUS\Documents\backupDBerp           # Backup binario PGDMP
Docker erp-restore (localhost:5433)           # DB local restaurada
prisma/migrations/20260819000000_f24_*/migration.sql
prisma/migrations/20260819000000_f25_*/migration.sql
prisma/schema.prisma                          # 5 cols cotizaciones, sin @@unique en ProductoSerie
src/lib/ventas/calculos.ts                    # Delivery + helpers observaciones
src/lib/ventas/schema.ts                      # costo_delivery en schema
src/lib/ventas/repository.ts                  # getClientesPage, crear/actualizar con delivery, getOrdenesPage (sin items), getCajaMovimientosPage, getClientesCursor
src/lib/inventario/repository.ts              # getProductosInventarioPage, getStockPorDepositoPage, getMovimientosInventarioPage
src/app/ventas/clientes/page.tsx
src/components/ventas/clientes-client.tsx
src/app/inventario/productos/page.tsx
src/components/inventario/productos-client.tsx
src/app/inventario/stock/page.tsx
src/components/inventario/stock-client.tsx
src/app/inventario/movimientos/page.tsx
src/components/inventario/movimientos-client.tsx
src/app/ventas/caja/page.tsx
src/components/ventas/caja-client.tsx
src/app/api/ventas/clientes/search/route.ts   # API search clientes (cursor-based)
src/app/api/inventario/productos/search/route.ts
src/app/api/inventario/stock/search/route.ts
src/app/api/inventario/movimientos/search/route.ts
src/app/api/ventas/caja/search/route.ts
src/lib/ventas/calculos.ts                    # Delivery + helpers observaciones
src/lib/ventas/schema.ts                      # costo_delivery en schema
src/lib/ventas/repository.ts                  # getClientesPage, crear/actualizar con delivery, getOrdenesPage (sin items), getCajaMovimientosPage, getClientesCursor
src/lib/inventario/repository.ts              # getProductosInventarioPage, getStockPorDepositoPage, getMovimientosInventarioPage
src/lib/auth/permisos.ts                      # RBAC centralizado (recursos, acciones, roles)
src/lib/auth.ts                               # requirePermiso, requireAlgunPermiso, requireTodosPermisos
src/lib/idempotencia/claves.ts                # Claves de idempotencia
src/lib/estados/maquina-estados.ts            # Máquinas de estado centralizadas
src/lib/operaciones/idempotencia-estados.ts   # Integración idempotencia + estados + outbox
src/lib/eventos/outbox.ts                     # Outbox pattern (tipos, tipos evento, helpers)
src/lib/eventos/processor.ts                  # Procesador outbox (batch, reintentos, stats)
src/lib/auditoria/repository.ts               # registrarActividad + outbox
.env                                           # DATABASE_URL/DIRECT_URL proyecto empresa
```

---

**Fin de auditoría — 2026-08-21**
---

## FASES 4/5 - CORRECCIONES FINALES (2026-08-24)

### Idempotencia atomica real (fix de race condition)

Problema detectado: verificarYRegistrarIdempotencia usaba find-then-create
(ventana de race bajo solicitudes concurrentes -> violacion UNIQUE no manejada).

Solucion implementada:
- src/lib/idempotencia/claves.ts: INSERT directo como punto de sincronizacion
  (equivale a INSERT ... ON CONFLICT DO NOTHING RETURNING). En conflicto
  (P2002) lanza OperacionDuplicadaError para ABORTAR la transaccion
  (PostgreSQL deja la tx en estado aborted tras una violacion UNIQUE: ninguna
  query posterior en la misma tx funciona - verificado en tests).
- src/lib/operaciones/idempotencia-estados.ts: ejecutarOperacionCritica captura
  OperacionDuplicadaError FUERA de la transaccion y devuelve
  { exito: true, yaProcesada: true, entidadId } (no-op idempotente).
- ContextoOperacion.actorId ahora opcional (operaciones de sistema); outbox
  escribe actor_id NULL si no hay usuario.
- Nuevos tipos de operacion: venta.completada|cancelada|cobrada|facturada|anulada,
  oc.enviada|cancelada|cerrada.

### Integracion de ejecutarOperacionCritica en flujos reales

- cambiarEstadoOrden (ventas/repository.ts): completar/cancelar corre dentro de
  Serializable con clave deterministica critica_orden_venta_<estado>_<id>,
  lock FOR UPDATE via obtenerYBloquearEstado, validacion por maquina de estados
  (validarTransicionEntidad) y evento outbox atomico. Preserva semanticas:
  completar dos veces = no-op, integridad financiera (no cancelar cobrada),
  reactivacion de seriales. Parametro usuario? opcional para contexto actor.
- transicionEstadoOc (compras/repository.ts): aprobar/enviar/cancelar/cerrar con
  claves critica_orden_compra_<accion>_<id>; dos enviar concurrentes crean
  exactamente UNA cuenta por pagar; maquina de estados valida transiciones.

### Cambio de semantica documentado

Duplicados (doble click / retry post-commit) ahora responden EXITO sin
re-ejecutar efectos en lugar de error. Tests actualizados:
- flujo.integration.test.ts: cancelar dos veces es idempotente.
- desastre.integration.test.ts: concurrentes validan invariantes (efectos
  aplicados una sola vez, stock intacto, CxP unica) en vez de exigir rechazo.

### Fixes de esquema descubiertos por tests de integracion

- Modelo IdempotenciaClave tenia campos camelCase sin @map, pero las tablas
  (public/test/docker) tienen columnas snake_case. Corregido con
  @map("entidad_id"), @map("entidad_tipo"), @map("created_at") + prisma
  generate. Cero DDL requerido.
- Tablas idempotencia_claves y eventos_outbox creadas tambien en el esquema
  test de Supabase (la suite de integracion corre ahi): DDL replicado de la
  migracion 20260822000000 via prisma db execute.
- importacion.integration.test.ts (pegasus): se salta con
  describe.skipIf(!FIXTURES_DISPONIBLES) cuando los XLSX reales no existen en
  la maquina (ruta original era de otro equipo; configurable via PEGASUS_DIR).
  Fallas eran ambientales y pre-existentes.

### Validacion (2026-08-24)

| Check | Resultado |
|---|---|
| tsc --noEmit | sin errores |
| Unit tests | 16 archivos / 155 passed |
| Integration (test:integration) | 31 passed, 5 skipped (pegasus fixtures ausentes) |
| next build | OK |
| prisma validate | OK |

Pendiente siguiente iteracion:
1. Migrar requireRole -> requirePermiso en acciones (RBAC granular ya disponible).
2. Worker que consuma eventos_outbox (procesarOutboxEventos ya implementado).
3. Usar prisma migrate deploy para produccion (no db push).

---

Fin de auditoria - 2026-08-21 (actualizado 2026-08-24)
---

## ITERACION 2026-08-24 (B): feedback de revision

### 1. Contexto de usuario propagado a operaciones criticas

Antes el outbox quedaba con actorNombre=Sistema y sin actorId. Ahora las 6
llamadas pasan { id, nombre, apellido, rol }:
- ventas-actions.ts: completarOrdenAction (L113), cancelarOrdenAction (L136)
- compras-actions.ts: aprobar/enviar/cancelar/cerrar OcAction

### 2. Reintento automatico de P2034 (conflicto Serializable)

ejecutarOperacionCritica ahora reintenta hasta 3 veces con backoff exponencial
(50/100/200 ms) ante P2034. El reintento es seguro porque la clave de
idempotencia se inserta dentro de la misma tx: si el intento anterior hizo
commit, el reintento cae en no-op duplicado (OperacionDuplicadaError); si
aborto, la clave no existe y la operacion corre limpio.
Helper exportado: esConflictoSerializacion(error).

### 3. Warning pg client.query() concurrente - causa raiz corregida

Fuentes encontradas y corregidas (queries paralelas sobre el MISMO cliente de
transaccion):
- auditoria/repository.ts L141: Promise.all(operaciones) -> bucle secuencial
  (se ejecuta best-effort en casi todos los flujos: principal emisor del warning)
- claves.ts obtenerEstadisticasIdempotencia: Promise.all x4 -> secuencial
- inventario/repository.ts transferencia: Promise.all 2 findUnique sobre tx -> secuencial
- pegasus/importer.ts revertirImportacion: Promise.all 3 deleteMany sobre tx -> secuencial
(los Promise.all sobre prisma pool en notificaciones/listados son legitimos:
cada query toma su propia conexion.)

Causa raiz restante en src/lib/prisma.ts: el SET search_path en el evento
connect del Pool competia con la primera query del adapter sobre el mismo
cliente. Reemplazado por opcion de arranque de conexion:
options=-c search_path=<schema>,public,extensions
Verificado EMPIRICAMENTE contra ambos endpoints Supabase: pooler 6543 y
directo 5432 aceptan options y fijan search_path=test correctamente.

Resultado en suite completa: warnings 3 -> 2 -> 1. El ultimo restante se emite
desde el manejo interno de errores del @prisma/adapter-pg durante el test de
concurrencia deliberada (tras el Unique constraint esperado). No es codigo
nuestro; seguimiento upstream, no bloquea.

### 4. Resultado completo conservado

test-results/integration-2026-08-24.log = salida integra de la ultima corrida:
2 archivos passed | 1 skipped, 31 tests passed / 5 skipped (pegasus sin
fixtures), duracion ~280s contra Supabase remota.

### Validacion final iteracion B

| Check | Resultado |
|---|---|
| tsc --noEmit | sin errores |
| Unit | 155 passed |
| Integracion (log conservado) | 31 passed, 5 skipped |
| next build | OK |
| Warnings pg | 1 residual (interno del adapter Prisma, upstream) |

### Pendiente explicito (cobertura parcial reconocida)

ejecutarOperacionCritica aun NO cubre: crear orden, registrarCobro, ajustes de
stock ni devoluciones. Notas de diseno para siguiente iteracion:
- Creaciones (crear orden): variante ejecutarCreacionCritica sin
  obtenerYBloquearEstado (la entidad aun no existe); clave deterministica a
  definir (hash de payload o clave provista por cliente).
- Cobros: clave candidata orden_id+monto+moneda+tipo_pago; cambia semantica del
  test reintento-de-cobro (hoy rechaza por saldo).
- Devoluciones: encaja directo en el helper actual (entidad existe, transicion
  pendiente->aprobada/rechazada).
============================================================
ITERACION 2026-08-24 (C): creacion rapida de productos en Compras
============================================================
Pedido del usuario: poder crear productos que no estan en el
catalogo al momento de armar una OC (paridad con proyecto React).

Cambios:
- compras-actions.ts: nueva crearProductoCompraAction (roles
  admin/compra/administracion/recepcion_compras; reusa
  crearProducto de inventario; captura P2002 -> mensaje claro;
  notificarYAcreditar + revalidate inventario y compras).
  Nota: la action existente crearProductoAction exige roles de
  inventario (admin/deposito/administracion/logistica), por eso
  no se reuso directo desde Compras.
- oc-form-client.tsx (Nueva OC): boton "+ Nuevo" por linea +
  modal (nombre, codigo, barcode, precio venta, costo compra,
  descripcion). Al crear: se agrega a lista local productosExtra,
  aparece en el select y se auto-asocia a la linea origen con
  unit_price = costo. Sin recargar la pagina.
- recepciones-client.tsx: ELIMINADO import de prisma en
  componente cliente (fuga de credenciales al bundle); eliminado
  handleCrearProducto roto (API Supabase-style + setItems
  inexistente). Reemplazado por useAction(crearProductoCompraAction).
  Modal movido a nivel raiz con campos precio/costo obligatorios
  del schema. Boton "+ Nuevo producto" en encabezado.

Validacion:
- npx tsc --noEmit: limpio.
- npm run test:run: 155 passed (16 archivos).
- npm run build: OK.

Pendiente (paridad con referencia React):
- Escaneo libre de barcode en recepcion (items hoy vienen atados
  a la OC; el referencia permite lineas libres por barcode).
- Seriales/desglose, fotos por item y subida de factura.
============================================================
ITERACION 2026-08-24 (D): paridad recepcion con ERP React
============================================================
Alcance: escaneo libre de barcode, seriales por unidad, fotos
por item (camara/archivo) y subida de archivo de factura.

Backend:
- schema.ts: items de registrarRecepcion ahora aceptan serial,
  observaciones y fotos[]; nuevo campo factura_archivo_url.
  RegistrarRecepcionInput pasa a z.input (defaults opcionales
  para callers, p.ej. scripts/flujos-fase13.mts).
- repository.ts registrarRecepcion: las lineas pueden venir
  desglosadas (varias filas del mismo oc_item_id, 1 unidad c/u).
  Se agregan cantidades por item para validar sobre-recepcion y
  actualizar la OC, pero se persiste UNA FILA POR LINEA en
  recepciones_compra_items (serial/fotos/obs propios). Se
  persiste factura_archivo_url.
- compras-actions.ts: buscarProductoPorBarcodeAction,
  sugerirCodigoProductoAction (proximo codigo unico, loop 50),
  adjuntarFacturaRecepcionAction (para uso futuro desde detalle).

Frontend (recepciones-client.tsx reescrito):
- Al abrir recepcion: desglose automatico en lineas de 1 unidad
  (una por pendiente) para cargar un serial por unidad.
- Columna barcode escaneable por linea (Enter = confirmar):
  resuelve producto o abre modal de creacion con codigo sugerido;
  al crear queda asignado a la linea.
- Serial con Enter->avanza al siguiente input (como referencia).
- Desglosar seriales (icono Split) cuando cantidad > 1.
- Fotos por item: camara (getUserMedia + canvas -> JPEG) o
  archivos multiples; bucket 'productos' con fallback
  'facturas-proveedores'; propagacion automatica a lineas del
  mismo producto + boton aplicar-a-todos; miniaturas con link.
- Factura: numero/fecha/monto + adjuntar PDF/imagen; el archivo
  se sube ANTES del execute (path recepciones/nuevas/) y la URL
  viaja en el input de la action (un solo viaje, sin lastResult).

Notas tecnicas:
- next-safe-action de este proyecto: SafeActionFn no expone
  executeAsync ni useAction expone lastResult; todo se hace con
  hooks onSuccess/onError + refs para estado fresco en callbacks.
- createBrowserClient (@/lib/supabase/client) para storage desde
  el navegador, igual que hacia supabase-js en el referencia.

Validacion:
- npx tsc --noEmit: limpio. Unit: 155 passed. next build: OK.
- Integracion contra Supabase: flujo 22/22, desastre 9/9.

Pendiente de paridad (no pedido explicitamente aun):
- Edicion de recepcion existente (useActualizarRecepcionCompra).
- Precio compra/venta editable por linea persistido en productos
  y precio_final por item.
- Lista y detalle de recepciones equivalentes al referencia.
============================================================
ITERACION 2026-08-24 (E): fix "Error interno del servidor"
============================================================
Sintoma: al crear un producto desde Compras aparecia el toast
generico "Error interno del servidor".

Diagnostico (scripts/diag-crear-producto.mts contra Supabase):
- Creacion normal: OK (el insert y los campos son correctos).
- Codigo duplicado: P2002 confirmado.
- Barcode repetido: SIN unique en DB (permite duplicados).
- Causa raiz UX: safe-action sanitizeErrorMessage solo dejaba
  pasar ActionError y 4 mensajes whitelisted de Prisma; TODOS
  los mensajes de dominio en espanol lanzados por repositorios
  ("Ya existe un producto con el codigo X", "OC no encontrada",
  sobre-recepcion, etc.) se enmascaraban como "Error interno
  del servidor". Bug pre-existente de toda la app.

Correcciones:
1) safe-action.ts: sanitizador ahora deja pasar mensajes de
   dominio y oculta solo marcadores internos conocidos (dump de
   invocacion Prisma, driver pg, DNS/TLS/auth de conexion).
   Se mantiene whitelist historica para los 4 mensajes Prisma
   seguros dentro del bloque interno.
2) crearProductoCompraAction: duplicados ahora lanzan
   ConflictError (ActionError, siempre visible): "Ya existe un
   producto con ese codigo o barcode".

Hallazgos colaterales:
- barcode de productos NO tiene unique en DB (igual que el ERP
  original); buscarProductoPorBarcode usa findFirst -> devuelve
  uno arbitrario si hay duplicados. Vigilar al importar/cargar.
- scripts/diag-crear-producto.mts queda como herramienta de
  diagnostico (npx tsx --env-file=.env ...). Nota: importa
  desde src/generated/prisma/client y no puede importar
  modulos con "server-only" fuera de Next/vitest.

Validacion: tsc OK - unit 155 passed - build OK.