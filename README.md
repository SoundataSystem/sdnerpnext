# PRODQA v2

ERP empresarial moderno. Migración del SPA (Vite) original hacia **Next.js fullstack enterprise**: Server Components, Server Actions con validación Zod, Prisma ORM, Supabase Auth y despliegue en Vercel.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router + Turbopack) |
| UI | Tailwind CSS v4 + shadcn/ui (en evolución) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Base de datos | Supabase PostgreSQL (Supabase Hosted) |
| Auth | Supabase Auth (@supabase/ssr) |
| Server Actions | next-safe-action v8 + zod-form-data |
| Validación | Zod / Standard Schema |
| Hosting | Vercel |

## Requisitos

- Node.js >= 20 (probado con v24)
- npm >= 10
- Proyecto Supabase existente (el de PROD QA)

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env` y rellena los valores reales (el `.env` ya existe con placeholders):

```env
# Supabase (públicas)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Supabase Service Role (SOLO servidor)
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Conexión PostgreSQL para Prisma (Runtime/Pooler)
DATABASE_URL="postgresql://postgres.tu-proyecto:password@aws-0-region.pooler.supabase.com:5432/postgres"

# URL pública de la app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Importante**: `DATABASE_URL` usa el **Pooler** de Supabase (PgBouncer) para el runtime en Vercel. Para CLI de Prisma (migrate/introspect) usa la conexión directa en `prisma.config.ts`.

### 3. Sincronizar esquema de Prisma

El archivo `prisma/schema.prisma` se generó manualmente a partir de `ESQUEMA DE BASE DE DATOS.txt` (48 tablas, enums de los CHECKs, relaciones completas). Para verificar que coincide con la base real:

```bash
npx prisma db pull   # introspecta la DB real (usa conexión directa)
```

O revisar diff:

```bash
npx prisma validate
```

### 4. Generar el cliente tipado

```bash
npx prisma generate
```

Genera el cliente en `src/generated/prisma` (gitignored).

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000. El proxy redirige a `/login` si no hay sesión.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm start` | Servir build de producción |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |
| `npx prisma generate` | Regenerar cliente Prisma |
| `npx prisma validate` | Validar schema |
| `npx prisma db pull` | Introspectar DB (requiere conexión) |

## Arquitectura de seguridad

- **Proxy (`src/proxy.ts`)**: capa de ruteo — redirige a `/login` si no hay sesión (solo cookies, sin DB).
- **RBAC en servidor (`src/lib/auth.ts`)**: `requireUser()` y `requireRole(...)` se ejecutan dentro de Server Actions y Server Components. Nunca confiar solo en el proxy.
- **Validación dual**: esquemas Zod ejecutados obligatoriamente en servidor vía `next-safe-action` (`actionClient.inputSchema(...)`).
- **Conexión Prisma**: singleton con driver adapter `PrismaPg`; en desarrollo se reutiliza el mismo cliente (evita agotar conexiones).

## Estructura

```
src/
├── app/
│   ├── page.tsx            # Dashboard protegido
│   ├── login/page.tsx      # Login (RSC estático)
│   ├── auth/callback/      # Callback OAuth de Supabase
│   ├── api/health/         # Health check
│   ├── layout.tsx
│   └── globals.css
├── components/auth/        # LoginForm, LogoutButton (client)
├── lib/
│   ├── prisma.ts           # Cliente Prisma singleton
│   ├── auth.ts             # getSession, getCurrentUser, requireUser, requireRole
│   ├── safe-action.ts      # Cliente base next-safe-action
│   ├── actions/auth-actions.ts  # Server Actions de auth
│   └── supabase/           # client.ts, server.ts, middleware.ts
├── proxy.ts                # Proxy de rutas (Next 16)
└── generated/prisma/       # Cliente generado (gitignored)
prisma/
└── schema.prisma           # Modelos + enums + relaciones (48 tablas)
```

## Producción (Vercel)

- **URL:** https://ovg-prodqa-v2.vercel.app (alias de `ovg-prodqa-v2-*.vercel.app`, team `sistemas-6754s-projects`, proyecto `ovg-prodqa-v2`)
- **Deploy:** `vercel --prod` desde `C:\Users\ASUS\Desktop\prodqa-v2` (ya linkeado via `.vercel/project.json`). Histórico: `95265aa`→`1f482c5` en rama `prodqa-v2` de https://github.com/SoundataSystem/sdnerpnext.
- **Variables Vercel Production (ver `vercel env ls`):**
  ```
  DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL, PRISMA_TX_TIMEOUT_MS,
  HEALTHCHECK_TOKEN, CRON_SECRET, OUTBOX_WEBHOOK_URL, OUTBOX_WEBHOOK_SECRET
  ```
  `DATABASE_URL` usa pooler 6543 (runtime), `DIRECT_URL` 5432 (migrate). `HEALTHCHECK_TOKEN`/`CRON_SECRET` son obligatorios en prod (fail-closed).

### Runbook

| Check | Comando |
|---|---|
| Health | `curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" https://ovg-prodqa-v2.vercel.app/api/health` → `{"status":"ok"}` (sin token 401, sin var 500) |
| Outbox cron | `curl -H "Authorization: Bearer $CRON_SECRET" https://ovg-prodqa-v2.vercel.app/api/cron/outbox` → `{"ok":true,"procesados":0…}`; cron Vercel `vercel.json:0 4 * * *` (Hobby 1/día) + externo cada 5min |
| Webhook E2E | `OUTBOX_WEBHOOK_URL=https://webhook.site/236ac0fa-742d-43f9-81cd-b22af1fff90b` (+ `OUTBOX_WEBHOOK_SECRET`). Test: insert PENDIENTE → `GET /api/cron/outbox` → webhook.site recibe `X-Correlation-Id/X-Outbox-Tipo` + body `{id,tipo,entidad,…}` (verificado 2026-09-02, panel `https://webhook.site/#!/view/236ac0fa-742d-43f9-81cd-b22af1fff90b`) |
| Cron externo sin GitHub | **cron-job.org** cada 5min GET con header `Authorization: Bearer $CRON_SECRET`. Alternativa GitHub Actions en `.github/workflows/outbox-cron.yml` (`*/5 * * * *`) requiere push a rama default + secret `CRON_SECRET` |
| Delivery migración | `shipping_fee` es fuente única; tag `DELIVERY:` legacy eliminado (script `scripts/limpiar-delivery-tags.mts --apply` migró 26 y limpió 33, 0 restantes) |

## Notas de la migración

- El esquema Prisma se derivó del DDL original **corrigiendo errores**: el `DEFAULT 'pendiente'` de `ordenes_compra.estado` no estaba en su CHECK (se agregó `pendiente` al enum), las relaciones duplicadas a `clientes`/`proveedores`/`usuarios` se nombraron explícitamente, y las columnas legacy sin FK se mantienen como campos planos.
- Los CHECKs de texto del DDL se convirtieron a **enums nativos de Prisma** para tipado fuerte (excepto `ordenes.sucursal`, que contiene `'ESPAÑA'` y `''`, no válidos como identificadores de enum).
